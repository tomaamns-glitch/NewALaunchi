const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const https = require("https");
const http = require("http");
const { spawn, exec } = require("child_process");
const { promisify } = require("util");
const crypto = require("crypto");
const os = require("os");

const execAsync = promisify(exec);

const isDev = process.env.NODE_ENV === "development";

// ─── CONFIGURACIÓN DEL LAUNCHER ────────────────────────────────────────────
// Cambia azureClientId por el tuyo antes de distribuir la app.
// Los usuarios finales no necesitan configurar nada.
const LAUNCHER_CONFIG = {
  azureClientId: "544a65b8-0d01-4dad-bb15-67202be45edc",
};
// ────────────────────────────────────────────────────────────────────────────

const APP_DATA_DIR = path.join(os.homedir(), ".alaunchi");
const INSTANCES_DIR = path.join(APP_DATA_DIR, "instances");
const CACHE_DIR = path.join(APP_DATA_DIR, "cache");
const JAVA_DIR = path.join(APP_DATA_DIR, "java");

async function ensureDirs() {
  await fs.mkdir(APP_DATA_DIR, { recursive: true });
  await fs.mkdir(INSTANCES_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(JAVA_DIR, { recursive: true });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 680,
    minWidth: 900,
    minHeight: 580,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#0d0d0d",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
      sandbox: false,
    },
    icon: path.join(__dirname, "../public/logo.png"),
    show: false,
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  ipcMain.on("window-minimize", () => win.minimize());
  ipcMain.on("window-maximize", () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on("window-close", () => win.close());

  return win;
}

app.whenReady().then(async () => {
  await ensureDirs();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fsSync.createWriteStream(destPath);
    const protocol = url.startsWith("https") ? https : http;

    const request = protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fsSync.unlinkSync(destPath);
        downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
        return;
      }
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let downloaded = 0;
      res.on("data", (chunk) => {
        downloaded += chunk.length;
        if (onProgress && total > 0) onProgress(Math.round((downloaded / total) * 100));
      });
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    });
    request.on("error", (err) => {
      file.close();
      fsSync.unlink(destPath, () => {});
      reject(err);
    });
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, { headers: { "User-Agent": "ALaunchi/1.0" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("Invalid JSON from " + url)); }
      });
    }).on("error", reject);
  });
}

ipcMain.handle("mc:get-installed-modpacks", async () => {
  try {
    const entries = await fs.readdir(INSTANCES_DIR, { withFileTypes: true });
    const installed = {};
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metaPath = path.join(INSTANCES_DIR, entry.name, "alaunchi-meta.json");
        if (fsSync.existsSync(metaPath)) {
          const meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
          installed[entry.name] = meta;
        }
      }
    }
    return installed;
  } catch {
    return {};
  }
});

ipcMain.handle("mc:install-modpack", async (event, { modpackId, modpack, files }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const instanceDir = path.join(INSTANCES_DIR, modpackId);
  const modsDir = path.join(instanceDir, "mods");
  const resourcepacksDir = path.join(instanceDir, "resourcepacks");
  const shaderpacks = path.join(instanceDir, "shaderpacks");

  await fs.mkdir(instanceDir, { recursive: true });
  await fs.mkdir(modsDir, { recursive: true });
  await fs.mkdir(resourcepacksDir, { recursive: true });
  await fs.mkdir(shaderpacks, { recursive: true });

  win?.webContents.send("install-progress", { modpackId, stage: "downloading", progress: 0 });

  for (let i = 0; i < (files || []).length; i++) {
    const file = files[i];
    if (!file.downloadUrl) continue;
    let destDir = instanceDir;
    if (file.type === "mod") destDir = modsDir;
    else if (file.type === "resourcepack") destDir = resourcepacksDir;
    else if (file.type === "shader") destDir = shaderpacks;
    const destPath = path.join(destDir, file.filename);
    await downloadFile(file.downloadUrl, destPath, (p) => {
      const overall = Math.round(((i + p / 100) / files.length) * 100);
      win?.webContents.send("install-progress", { modpackId, stage: "downloading", progress: overall });
    });
  }

  const meta = {
    id: modpackId,
    name: modpack?.name ?? modpackId,
    version: modpack?.version ?? "1.0.0",
    minecraftVersion: modpack?.minecraftVersion ?? "1.20.4",
    loaderType: modpack?.loaderType ?? "vanilla",
    installedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(instanceDir, "alaunchi-meta.json"), JSON.stringify(meta, null, 2));

  win?.webContents.send("install-progress", { modpackId, stage: "done", progress: 100 });
  return { success: true };
});

ipcMain.handle("mc:update-modpack", async (event, { modpackId, filesToDelete, filesToAdd }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const instanceDir = path.join(INSTANCES_DIR, modpackId);

  win?.webContents.send("install-progress", { modpackId, stage: "updating", progress: 0 });

  for (const filename of (filesToDelete || [])) {
    const possiblePaths = [
      path.join(instanceDir, "mods", filename),
      path.join(instanceDir, "resourcepacks", filename),
      path.join(instanceDir, "shaderpacks", filename),
      path.join(instanceDir, filename),
    ];
    for (const p of possiblePaths) {
      if (fsSync.existsSync(p)) { await fs.unlink(p); break; }
    }
  }

  win?.webContents.send("install-progress", { modpackId, stage: "updating", progress: 50 });

  for (let i = 0; i < (filesToAdd || []).length; i++) {
    const file = filesToAdd[i];
    if (!file.downloadUrl) continue;
    let destDir = instanceDir;
    if (file.type === "mod") destDir = path.join(instanceDir, "mods");
    else if (file.type === "resourcepack") destDir = path.join(instanceDir, "resourcepacks");
    else if (file.type === "shader") destDir = path.join(instanceDir, "shaderpacks");
    const destPath = path.join(destDir, file.filename);
    await downloadFile(file.downloadUrl, destPath, () => {});
  }

  win?.webContents.send("install-progress", { modpackId, stage: "done", progress: 100 });
  return { success: true };
});

ipcMain.handle("mc:launch", async (event, { modpackId, mcVersion, loaderType, authToken, username, uuid }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.webContents.send("launch-status", { modpackId, stage: "preparing" });

  const versionManifest = await fetchJson("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json");
  const versionEntry = versionManifest.versions.find((v) => v.id === mcVersion);
  if (!versionEntry) throw new Error(`Minecraft version ${mcVersion} not found`);

  const versionJson = await fetchJson(versionEntry.url);
  const versionDir = path.join(CACHE_DIR, "versions", mcVersion);
  const librariesDir = path.join(CACHE_DIR, "libraries");
  const assetsDir = path.join(CACHE_DIR, "assets");
  const nativesDir = path.join(CACHE_DIR, "natives", mcVersion);

  await fs.mkdir(versionDir, { recursive: true });
  await fs.mkdir(librariesDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.mkdir(nativesDir, { recursive: true });

  win?.webContents.send("launch-status", { modpackId, stage: "downloading_client" });
  const clientJarPath = path.join(versionDir, `${mcVersion}.jar`);
  if (!fsSync.existsSync(clientJarPath)) {
    await downloadFile(versionJson.downloads.client.url, clientJarPath, () => {});
  }

  win?.webContents.send("launch-status", { modpackId, stage: "downloading_assets" });
  const assetIndexId = versionJson.assetIndex.id;
  const assetIndexDir = path.join(assetsDir, "indexes");
  await fs.mkdir(assetIndexDir, { recursive: true });
  const assetIndexPath = path.join(assetIndexDir, `${assetIndexId}.json`);
  if (!fsSync.existsSync(assetIndexPath)) {
    await downloadFile(versionJson.assetIndex.url, assetIndexPath, () => {});
  }

  const assetIndex = JSON.parse(await fs.readFile(assetIndexPath, "utf8"));
  const objectsDir = path.join(assetsDir, "objects");
  const assetEntries = Object.entries(assetIndex.objects || {});
  let downloadedAssets = 0;
  const ASSET_BATCH = 20;

  for (let i = 0; i < assetEntries.length; i += ASSET_BATCH) {
    const batch = assetEntries.slice(i, i + ASSET_BATCH);
    await Promise.all(
      batch.map(async ([, obj]) => {
        const hash = obj.hash;
        const prefix = hash.substring(0, 2);
        const assetDir = path.join(objectsDir, prefix);
        await fs.mkdir(assetDir, { recursive: true });
        const assetPath = path.join(assetDir, hash);
        if (!fsSync.existsSync(assetPath)) {
          await downloadFile(`https://resources.download.minecraft.net/${prefix}/${hash}`, assetPath, () => {});
        }
      })
    );
    downloadedAssets += batch.length;
    win?.webContents.send("launch-status", {
      modpackId, stage: "downloading_assets",
      progress: Math.round((downloadedAssets / assetEntries.length) * 100),
    });
  }

  win?.webContents.send("launch-status", { modpackId, stage: "downloading_libraries" });
  const classpath = [clientJarPath];
  const currentPlatform = process.platform.replace("win32", "windows").replace("darwin", "osx");

  for (const lib of versionJson.libraries || []) {
    if (lib.rules) {
      const allowed = lib.rules.every((rule) => {
        if (rule.action === "allow") return !rule.os || rule.os.name === currentPlatform;
        if (rule.action === "disallow") return rule.os && rule.os.name !== currentPlatform;
        return true;
      });
      if (!allowed) continue;
    }
    if (lib.downloads?.artifact) {
      const artifact = lib.downloads.artifact;
      const libPath = path.join(librariesDir, artifact.path);
      await fs.mkdir(path.dirname(libPath), { recursive: true });
      if (!fsSync.existsSync(libPath)) await downloadFile(artifact.url, libPath, () => {});
      classpath.push(libPath);
    }
  }

  const instanceDir = path.join(INSTANCES_DIR, modpackId);
  const modsDir = path.join(instanceDir, "mods");
  await fs.mkdir(modsDir, { recursive: true });

  win?.webContents.send("launch-status", { modpackId, stage: "downloading_libraries" });

  let mainClass = versionJson.mainClass;
  let loaderProfile = null;
  let loaderLibsDir = librariesDir;

  if (loaderType === "fabric" || loaderType === "quilt") {
    try {
      win?.webContents.send("launch-status", { modpackId, stage: "installing_loader" });
      const loaderMeta = await fetchJson("https://meta.fabricmc.net/v2/versions/loader");
      const latestLoader = loaderMeta[0].version;
      const fabricProfile = await fetchJson(
        `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${latestLoader}/profile/json`
      );
      loaderProfile = fabricProfile;
      mainClass = fabricProfile.mainClass;
      for (const lib of fabricProfile.libraries || []) {
        const parts = lib.name.split(":");
        const [group, artifact, ver] = parts;
        const groupPath = group.replace(/\./g, "/");
        const jarName = `${artifact}-${ver}.jar`;
        const relPath = `${groupPath}/${artifact}/${ver}/${jarName}`;
        const libPath = path.join(librariesDir, relPath);
        await fs.mkdir(path.dirname(libPath), { recursive: true });
        if (!fsSync.existsSync(libPath)) {
          const baseUrl = lib.url || "https://repo1.maven.org/maven2/";
          await downloadFile(baseUrl + relPath, libPath, () => {});
        }
        classpath.push(libPath);
      }
    } catch (e) {
      console.error("[Fabric] Error:", e.message);
    }
  }

  if (loaderType === "neoforge") {
    try {
      win?.webContents.send("launch-status", { modpackId, stage: "installing_loader" });
      const neoforgeVersion = await resolveNeoforgeVersion(mcVersion);
      if (!neoforgeVersion) throw new Error(`No se encontró NeoForge para MC ${mcVersion}`);
      console.log(`[NeoForge] Usando versión ${neoforgeVersion}`);
      const { profile, installLibsDir } = await runForgeInstaller(
        "neoforge", neoforgeVersion, mcVersion,
        (msg) => win?.webContents.send("launch-status", { modpackId, stage: "installing_loader", msg }),
        clientJarPath
      );
      loaderProfile = profile;
      loaderLibsDir = installLibsDir;
      if (profile.mainClass) mainClass = profile.mainClass;
      for (const lib of profile.libraries || []) {
        const libPath = await resolveModloaderLibrary(lib, librariesDir, [
          "https://maven.neoforged.net/releases/",
          "https://libraries.minecraft.net/",
          "https://repo1.maven.org/maven2/",
        ], installLibsDir);
        if (libPath) classpath.push(libPath);
      }
    } catch (e) {
      console.error("[NeoForge] Error:", e.message);
      throw new Error(`No se pudo instalar NeoForge para MC ${mcVersion}: ${e.message}`);
    }
  }

  if (loaderType === "forge") {
    try {
      win?.webContents.send("launch-status", { modpackId, stage: "installing_loader" });
      const forgeVersion = await resolveForgeVersion(mcVersion);
      if (!forgeVersion) throw new Error(`No se encontró Forge para MC ${mcVersion}`);
      console.log(`[Forge] Usando versión ${forgeVersion}`);
      const { profile, installLibsDir } = await runForgeInstaller(
        "forge", forgeVersion, mcVersion,
        (msg) => win?.webContents.send("launch-status", { modpackId, stage: "installing_loader", msg }),
        clientJarPath
      );
      loaderProfile = profile;
      loaderLibsDir = installLibsDir;
      if (profile.mainClass) mainClass = profile.mainClass;
      for (const lib of profile.libraries || []) {
        const libPath = await resolveModloaderLibrary(lib, librariesDir, [
          "https://maven.minecraftforge.net/",
          "https://libraries.minecraft.net/",
          "https://repo1.maven.org/maven2/",
        ], installLibsDir);
        if (libPath) classpath.push(libPath);
      }
    } catch (e) {
      console.error("[Forge] Error:", e.message);
      throw new Error(`No se pudo instalar Forge para MC ${mcVersion}: ${e.message}`);
    }
  }

  win?.webContents.send("launch-status", { modpackId, stage: "launching" });

  let javaPath = await getJavaPath();
  if (!javaPath) {
    try { await execAsync("java -version"); javaPath = "java"; }
    catch { throw new Error("Java no encontrado. Ve a Ajustes e instala Java primero."); }
  }

  const dedupedClasspath = [...new Set(classpath)];

  const mcArgs = buildLaunchArgs({ ...versionJson, mainClass }, {
    username: username || "Player",
    uuid: uuid || "00000000-0000-0000-0000-000000000000",
    accessToken: authToken || "offline",
    gameDir: instanceDir,
    assetsDir,
    assetIndex: assetIndexId,
    version: mcVersion,
    classpath: dedupedClasspath.join(path.delimiter),
    nativesDir,
    librariesDir: loaderLibsDir,
    mcVersion,
    width: "1280",
    height: "720",
  }, loaderProfile);

  console.log("[Launch] Java:", javaPath);
  console.log("[Launch] MainClass:", mainClass);
  console.log("[Launch] Args count:", mcArgs.length);

  const logFile = path.join(instanceDir, "launch.log");
  let logFd;
  try {
    await fs.mkdir(instanceDir, { recursive: true });
    logFd = fsSync.openSync(logFile, "w");
  } catch { logFd = null; }

  const stdio = logFd !== null
    ? ["ignore", logFd, logFd]
    : ["ignore", "ignore", "ignore"];

  const child = spawn(javaPath, mcArgs, { detached: true, stdio });
  if (logFd !== null) fsSync.closeSync(logFd);

  child.on("error", (err) => {
    console.error("[Launch] Spawn error:", err.message);
    win?.webContents.send("launch-status", { modpackId, stage: "error", message: err.message });
  });

  await new Promise((resolve) => setTimeout(resolve, 5000));

  const exitCode = child.exitCode;
  if (exitCode !== null && exitCode !== 0) {
    let logContent = "";
    try { logContent = (await fs.readFile(logFile, "utf8")).slice(-5000); } catch {}
    console.error("[Launch] Java crashed (code", exitCode, "):\n", logContent);
    win?.webContents.send("launch-status", { modpackId, stage: "error", message: `Java salió con código ${exitCode}` });
    throw new Error(`Java salió con código ${exitCode}. Log guardado en: ${logFile}`);
  }

  if (child.exitCode === 0) {
    console.warn("[Launch] Java exited cleanly (code 0) — could be a quick crash, check log:", logFile);
  }

  child.unref();
  win?.webContents.send("launch-status", { modpackId, stage: "launched" });
  return { success: true, pid: child.pid };
});

async function resolveNeoforgeVersion(mcVersion) {
  try {
    const data = await fetchJson(
      "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge"
    );
    const versions = data.versions || [];
    const parts = mcVersion.split(".");
    const major = parts[1];
    const minor = parts[2] || "0";
    let prefix;
    if (mcVersion === "1.20.1") {
      prefix = "47.";
    } else {
      prefix = `${major}.${minor}.`;
    }
    const matching = versions.filter((v) => v.startsWith(prefix));
    if (!matching.length) return null;
    return matching[matching.length - 1];
  } catch {
    return null;
  }
}

async function resolveForgeVersion(mcVersion) {
  try {
    const data = await fetchJson(
      "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json"
    );
    const promos = data.promos || {};
    return promos[`${mcVersion}-recommended`] || promos[`${mcVersion}-latest`] || null;
  } catch {
    return null;
  }
}

async function extractJsonFromJar(jarPath, entryName) {
  const tmpOut = jarPath + ".extracted.json";
  try {
    if (process.platform === "win32") {
      const ps = `
        Add-Type -Assembly System.IO.Compression.FileSystem;
        $z = [System.IO.Compression.ZipFile]::OpenRead('${jarPath.replace(/\\/g, "\\\\")}');
        $e = $z.Entries | Where-Object { $_.FullName -eq '${entryName}' };
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, '${tmpOut.replace(/\\/g, "\\\\")}', $true);
        $z.Dispose()
      `.trim().replace(/\n\s+/g, "; ");
      await execAsync(`powershell -NoProfile -Command "${ps}"`);
    } else {
      await execAsync(`unzip -p "${jarPath}" "${entryName}" > "${tmpOut}"`);
    }
    const content = await fs.readFile(tmpOut, "utf8");
    await fs.unlink(tmpOut).catch(() => {});
    return JSON.parse(content);
  } catch (e) {
    await fs.unlink(tmpOut).catch(() => {});
    throw e;
  }
}

async function runForgeInstaller(loaderType, loaderVersion, mcVersion, sendStatus, existingClientJar = null) {
  let versionId, installerFilename, installerUrl;

  if (loaderType === "neoforge") {
    versionId = `neoforge-${loaderVersion}`;
    installerFilename = `neoforge-${loaderVersion}-installer.jar`;
    installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${loaderVersion}/${installerFilename}`;
  } else {
    const fullVersion = `${mcVersion}-${loaderVersion}`;
    versionId = `forge-${fullVersion}`;
    installerFilename = `forge-${fullVersion}-installer.jar`;
    installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullVersion}/${installerFilename}`;
  }

  const installDir = path.join(CACHE_DIR, versionId);
  const versionJsonPath = path.join(installDir, "versions", versionId, `${versionId}.json`);
  const installLibsDir = path.join(installDir, "libraries");

  async function findVersionJson() {
    const versionsDir = path.join(installDir, "versions");
    const dirs = await fs.readdir(versionsDir).catch(() => []);
    for (const dir of dirs) {
      const candidate = path.join(versionsDir, dir, `${dir}.json`);
      if (fsSync.existsSync(candidate)) return candidate;
    }
    return null;
  }

  const existingJson = fsSync.existsSync(versionJsonPath)
    ? versionJsonPath
    : await findVersionJson();

  if (existingJson) {
    const profile = JSON.parse(await fs.readFile(existingJson, "utf8"));
    return { profile, installLibsDir };
  }

  await fs.rm(installDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(installDir, { recursive: true });

  if (existingClientJar && fsSync.existsSync(existingClientJar)) {
    const mcVersionsDir = path.join(installDir, "versions", mcVersion);
    await fs.mkdir(mcVersionsDir, { recursive: true });
    await fs.copyFile(existingClientJar, path.join(mcVersionsDir, `${mcVersion}.jar`)).catch(() => {});
  }

  const installerPath = path.join(CACHE_DIR, installerFilename);
  sendStatus?.("Descargando instalador...");
  await downloadFile(installerUrl, installerPath, () => {});

  sendStatus?.("Instalando (1-2 min, solo la primera vez)...");
  const javaExe = await getJavaPath() || "java";

  let installerError = null;
  try {
    const { stdout, stderr } = await execAsync(
      `"${javaExe}" -Djava.awt.headless=true -Djava.net.preferIPv4Stack=true -jar "${installerPath}" --installClient`,
      { cwd: installDir, timeout: 300000, maxBuffer: 50 * 1024 * 1024 }
    );
    if (stdout) console.log("[Installer stdout]", stdout.slice(-3000));
    if (stderr) console.log("[Installer stderr]", stderr.slice(-1000));
  } catch (e) {
    installerError = e;
    console.error("[Installer] Non-zero exit, checking if files were created...");
    console.error("[Installer] STDOUT:", e.stdout?.slice(-3000));
    console.error("[Installer] STDERR:", e.stderr?.slice(-1000));
  }

  await fs.unlink(installerPath).catch(() => {});

  const installedJson = fsSync.existsSync(versionJsonPath)
    ? versionJsonPath
    : await findVersionJson();

  if (!installedJson) {
    await fs.rm(installDir, { recursive: true, force: true }).catch(() => {});
    const errMsg = installerError
      ? `${installerError.stderr?.slice(-1500) || installerError.stdout?.slice(-1500) || installerError.message}`
      : "No se encontró el version.json resultante";
    throw new Error(`Installer de ${loaderType} falló:\n${errMsg}`);
  }
  console.log("[Installer] Éxito, versión JSON en:", installedJson);

  const profile = JSON.parse(await fs.readFile(installedJson, "utf8"));
  return { profile, installLibsDir };
}

async function resolveModloaderLibrary(lib, librariesDir, mavenBases, installLibsDir = null) {
  function installerPath(relPath) {
    if (!installLibsDir) return null;
    const p = path.join(installLibsDir, relPath);
    return fsSync.existsSync(p) ? p : null;
  }

  if (lib.downloads?.artifact) {
    const artifact = lib.downloads.artifact;
    const relPath = artifact.path;
    const fromInstaller = installerPath(relPath);
    if (fromInstaller) return fromInstaller;
    const libPath = path.join(librariesDir, relPath);
    await fs.mkdir(path.dirname(libPath), { recursive: true });
    if (!fsSync.existsSync(libPath)) {
      await downloadFile(artifact.url, libPath, () => {});
    }
    return libPath;
  }
  if (lib.name) {
    const parts = lib.name.split(":");
    if (parts.length < 3) return null;
    const [group, artifact, ver, classifier] = parts;
    const groupPath = group.replace(/\./g, "/");
    const jarName = classifier
      ? `${artifact}-${ver}-${classifier}.jar`
      : `${artifact}-${ver}.jar`;
    const relPath = `${groupPath}/${artifact}/${ver}/${jarName}`;
    const fromInstaller = installerPath(relPath);
    if (fromInstaller) return fromInstaller;
    const libPath = path.join(librariesDir, relPath);
    await fs.mkdir(path.dirname(libPath), { recursive: true });
    if (!fsSync.existsSync(libPath)) {
      for (const base of mavenBases) {
        try {
          await downloadFile(base + relPath, libPath, () => {});
          if (fsSync.existsSync(libPath)) break;
        } catch {
          if (fsSync.existsSync(libPath)) fsSync.unlinkSync(libPath);
        }
      }
    }
    return fsSync.existsSync(libPath) ? libPath : null;
  }
  return null;
}

function buildLaunchArgs(versionJson, opts, loaderProfile = null) {
  const argMap = {
    "${auth_player_name}": opts.username,
    "${version_name}": opts.version,
    "${game_directory}": opts.gameDir,
    "${assets_root}": opts.assetsDir,
    "${assets_index_name}": opts.assetIndex,
    "${auth_uuid}": opts.uuid,
    "${auth_access_token}": opts.accessToken,
    "${user_type}": "msa",
    "${version_type}": "release",
    "${resolution_width}": opts.width,
    "${resolution_height}": opts.height,
    "${library_directory}": opts.librariesDir,
    "${classpath_separator}": path.delimiter,
    "${primary_jar}": opts.classpath.split(path.delimiter)[0],
    "${natives_directory}": opts.nativesDir,
    "${launcher_name}": "ALaunchi",
    "${launcher_version}": "1.0",
    "${classpath}": opts.classpath,
  };

  function resolveArg(arg) {
    let resolved = arg;
    for (const [k, v] of Object.entries(argMap)) {
      resolved = resolved.replaceAll(k, v);
    }
    return resolved;
  }

  function expandArgs(rawList) {
    const out = [];
    for (const entry of rawList) {
      if (typeof entry === "string") {
        out.push(resolveArg(entry));
      } else if (entry && typeof entry === "object" && entry.value) {
        const vals = Array.isArray(entry.value) ? entry.value : [entry.value];
        for (const v of vals) out.push(resolveArg(v));
      }
    }
    return out;
  }

  const baseJvmArgs = [
    "-Xmx2G", "-Xms512M",
    `-Djava.library.path=${opts.nativesDir}`,
    "-Dminecraft.launcher.brand=ALaunchi",
    "-Dminecraft.launcher.version=1.0",
  ];

  const loaderJvmArgs = loaderProfile?.arguments?.jvm
    ? expandArgs(loaderProfile.arguments.jvm)
    : [];

  const classpathArgs = ["-cp", opts.classpath];

  const rawGameArgs = versionJson.arguments?.game || versionJson.minecraftArguments?.split(" ") || [];
  const gameArgs = expandArgs(rawGameArgs);
  const loaderGameArgs = loaderProfile?.arguments?.game
    ? expandArgs(loaderProfile.arguments.game)
    : [];

  const allGameArgs = [...gameArgs, ...loaderGameArgs];

  return [
    ...baseJvmArgs,
    ...loaderJvmArgs,
    ...classpathArgs,
    versionJson.mainClass,
    ...allGameArgs,
  ];
}

async function getJavaPath() {
  const homeFile = path.join(JAVA_DIR, ".java-home");
  if (fsSync.existsSync(homeFile)) {
    const jreDir = (await fs.readFile(homeFile, "utf8")).trim();
    const bin = path.join(jreDir, "bin", process.platform === "win32" ? "java.exe" : "java");
    if (fsSync.existsSync(bin)) return bin;
  }
  return null;
}

ipcMain.handle("mc:check-java", async () => {
  const customPath = await getJavaPath();
  if (customPath) return { available: true, version: "bundled", path: customPath };
  try {
    const { stdout, stderr } = await execAsync("java -version 2>&1");
    return { available: true, version: (stdout || stderr).split("\n")[0].trim() };
  } catch {
    return { available: false };
  }
});

ipcMain.handle("mc:install-java", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const platform = process.platform;
  const arch = process.arch;
  const adoptiumOS = platform === "win32" ? "windows" : platform === "darwin" ? "mac" : "linux";
  const adoptiumArch = arch === "arm64" ? "aarch64" : "x64";

  win?.webContents.send("java-install-progress", { stage: "fetching", progress: 0 });

  const releases = await fetchJson(
    `https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=${adoptiumArch}&image_type=jre&os=${adoptiumOS}&vendor=eclipse`
  );
  if (!releases || releases.length === 0) throw new Error("No se encontró JRE 21 en Adoptium");

  const pkg = releases[0].binary.package;
  const downloadUrl = pkg.link;
  const filename = pkg.name;
  const isZip = filename.endsWith(".zip");
  const downloadPath = path.join(JAVA_DIR, filename);

  win?.webContents.send("java-install-progress", { stage: "downloading", progress: 0 });
  await downloadFile(downloadUrl, downloadPath, (p) => {
    win?.webContents.send("java-install-progress", { stage: "downloading", progress: p });
  });

  win?.webContents.send("java-install-progress", { stage: "extracting", progress: 0 });

  if (isZip) {
    await execAsync(
      `powershell -NoProfile -Command "Expand-Archive -Force -Path '${downloadPath}' -DestinationPath '${JAVA_DIR}'"`
    );
  } else {
    await execAsync(`tar -xzf "${downloadPath}" -C "${JAVA_DIR}"`);
  }

  const entries = await fs.readdir(JAVA_DIR, { withFileTypes: true });
  const jreFolder = entries.find(
    (e) => e.isDirectory() && (e.name.startsWith("jdk") || e.name.startsWith("jre"))
  );
  if (!jreFolder) throw new Error("No se encontró la carpeta del JRE extraído");

  const jrePath = path.join(JAVA_DIR, jreFolder.name);
  await fs.writeFile(path.join(JAVA_DIR, ".java-home"), jrePath);
  await fs.unlink(downloadPath).catch(() => {});

  win?.webContents.send("java-install-progress", { stage: "done", progress: 100 });
  return { success: true, jrePath };
});

ipcMain.handle("ms:device-code-auth", async (_, args) => {
  const clientId = args?.clientId || LAUNCHER_CONFIG.azureClientId;
  if (!clientId) return Promise.reject(new Error("Azure Client ID no configurado. Ve a Ajustes e introduce tu Client ID de Azure."));
  return new Promise((resolve, reject) => {
    const postData = `client_id=${clientId}&scope=XboxLive.signin%20offline_access`;
    const req = https.request({
      hostname: "login.microsoftonline.com",
      path: "/consumers/oauth2/v2.0/devicecode",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(postData) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const p = JSON.parse(data);
          if (p.error) {
            console.error("[MS Auth] Device code error:", p.error, p.error_description);
            return reject(new Error(p.error_description || p.error));
          }
          shell.openExternal(p.verification_uri);
          resolve({ userCode: p.user_code, verificationUri: p.verification_uri, expiresIn: p.expires_in, interval: p.interval, deviceCode: p.device_code });
        } catch (e) { reject(e); }
      });
    });
    req.on("error", (e) => { console.error("[MS Auth] Network error:", e.message); reject(e); });
    req.write(postData);
    req.end();
  });
});

ipcMain.handle("ms:poll-token", async (_, { deviceCode, clientId }) => {
  const cid = clientId || LAUNCHER_CONFIG.azureClientId;
  return new Promise((resolve, reject) => {
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:device_code&client_id=${cid}&device_code=${deviceCode}`;
    const req = https.request({
      hostname: "login.microsoftonline.com",
      path: "/consumers/oauth2/v2.0/token",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(postData) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
});

ipcMain.handle("ms:refresh-token", async (_, { refreshToken, clientId }) => {
  const cid = clientId || LAUNCHER_CONFIG.azureClientId;
  return new Promise((resolve, reject) => {
    const postData = `grant_type=refresh_token&client_id=${cid}&refresh_token=${encodeURIComponent(refreshToken)}&scope=XboxLive.signin%20offline_access`;
    const req = https.request({
      hostname: "login.microsoftonline.com",
      path: "/consumers/oauth2/v2.0/token",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(postData) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const p = JSON.parse(data);
          resolve(p.access_token ? { access_token: p.access_token, refresh_token: p.refresh_token } : null);
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
});

ipcMain.handle("ms:xbox-auth", async (_, { msToken }) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${msToken}` },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    });
    const req = https.request({
      hostname: "user.auth.xboxlive.com",
      path: "/user/authenticate",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), Accept: "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { const p = JSON.parse(data); resolve({ xblToken: p.Token, userHash: p.DisplayClaims?.xui?.[0]?.uhs }); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
});

ipcMain.handle("ms:xsts-auth", async (_, { xblToken }) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      Properties: { SandboxId: "RETAIL", UserTokens: [xblToken] },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    });
    const req = https.request({
      hostname: "xsts.auth.xboxlive.com",
      path: "/xsts/authorize",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), Accept: "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { const p = JSON.parse(data); resolve({ xstsToken: p.Token, userHash: p.DisplayClaims?.xui?.[0]?.uhs }); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
});

ipcMain.handle("ms:mc-auth", async (_, { xstsToken, userHash }) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ identityToken: `XBL3.0 x=${userHash};${xstsToken}` });
    const req = https.request({
      hostname: "api.minecraftservices.com",
      path: "/authentication/login_with_xbox",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { const p = JSON.parse(data); resolve({ mcToken: p.access_token }); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
});

ipcMain.handle("ms:mc-profile", async (_, { mcToken }) => {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: "api.minecraftservices.com",
      path: "/minecraft/profile",
      headers: { Authorization: `Bearer ${mcToken}` },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { const p = JSON.parse(data); resolve({ username: p.name, uuid: p.id }); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
});

ipcMain.handle("fs:read-settings", async () => {
  try { return JSON.parse(await fs.readFile(path.join(APP_DATA_DIR, "settings.json"), "utf8")); }
  catch { return {}; }
});

ipcMain.handle("fs:write-settings", async (_, settings) => {
  await fs.writeFile(path.join(APP_DATA_DIR, "settings.json"), JSON.stringify(settings, null, 2));
  return { success: true };
});

ipcMain.handle("fs:read-auth", async () => {
  try { return JSON.parse(await fs.readFile(path.join(APP_DATA_DIR, "auth.json"), "utf8")); }
  catch { return null; }
});

ipcMain.handle("fs:write-auth", async (_, auth) => {
  await fs.writeFile(path.join(APP_DATA_DIR, "auth.json"), JSON.stringify(auth, null, 2));
  return { success: true };
});

ipcMain.handle("fs:clear-auth", async () => {
  try { await fs.unlink(path.join(APP_DATA_DIR, "auth.json")); } catch {}
  return { success: true };
});

ipcMain.handle("github:fetch-modpacks", async (_, { repoUrl }) => {
  try {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub URL");
    const [, owner, repo] = match;
    return await fetchJson(`https://raw.githubusercontent.com/${owner}/${repo}/main/modpacks.json`);
  } catch (e) {
    throw new Error("Could not load modpacks from GitHub: " + e.message);
  }
});

ipcMain.handle("github:create-release", async () => {
  return { success: true };
});

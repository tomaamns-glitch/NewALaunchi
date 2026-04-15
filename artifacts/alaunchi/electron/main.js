import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import fsSync from "fs";
import https from "https";
import http from "http";
import { spawn, exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import { createWriteStream } from "fs";
import os from "os";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development";

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
    win.loadFile(path.join(__dirname, "../dist/public/index.html"));
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
  const win = createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    const protocol = url.startsWith("https") ? https : http;

    const request = protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fsSync.unlinkSync(destPath);
        downloadFile(res.headers.location, destPath, onProgress)
          .then(resolve)
          .catch(reject);
        return;
      }

      const total = parseInt(res.headers["content-length"] || "0", 10);
      let downloaded = 0;

      res.on("data", (chunk) => {
        downloaded += chunk.length;
        if (onProgress && total > 0) {
          onProgress(Math.round((downloaded / total) * 100));
        }
      });

      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
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
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Invalid JSON from " + url));
        }
      });
    }).on("error", reject);
  });
}

function sha1File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = fsSync.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
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

ipcMain.handle("mc:install-modpack", async (event, { modpackId, modpack, files, token }) => {
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

  for (let i = 0; i < files.length; i++) {
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
    name: modpack.name,
    version: modpack.version,
    minecraftVersion: modpack.minecraftVersion,
    loaderType: modpack.loaderType,
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

  for (const filename of filesToDelete) {
    const possiblePaths = [
      path.join(instanceDir, "mods", filename),
      path.join(instanceDir, "resourcepacks", filename),
      path.join(instanceDir, "shaderpacks", filename),
      path.join(instanceDir, filename),
    ];
    for (const p of possiblePaths) {
      if (fsSync.existsSync(p)) {
        await fs.unlink(p);
        break;
      }
    }
  }

  win?.webContents.send("install-progress", { modpackId, stage: "updating", progress: 50 });

  for (let i = 0; i < filesToAdd.length; i++) {
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
  const assetIndexUrl = versionJson.assetIndex.url;
  const assetIndexId = versionJson.assetIndex.id;
  const assetIndexDir = path.join(assetsDir, "indexes");
  await fs.mkdir(assetIndexDir, { recursive: true });
  const assetIndexPath = path.join(assetIndexDir, `${assetIndexId}.json`);

  if (!fsSync.existsSync(assetIndexPath)) {
    await downloadFile(assetIndexUrl, assetIndexPath, () => {});
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
          const url = `https://resources.download.minecraft.net/${prefix}/${hash}`;
          await downloadFile(url, assetPath, () => {});
        }
      })
    );
    downloadedAssets += batch.length;
    win?.webContents.send("launch-status", {
      modpackId,
      stage: "downloading_assets",
      progress: Math.round((downloadedAssets / assetEntries.length) * 100),
    });
  }

  win?.webContents.send("launch-status", { modpackId, stage: "downloading_libraries" });
  const classpath = [clientJarPath];

  for (const lib of versionJson.libraries || []) {
    if (lib.rules) {
      const allowed = lib.rules.every((rule) => {
        if (rule.action === "allow") {
          if (!rule.os) return true;
          return rule.os.name === process.platform.replace("win32", "windows").replace("darwin", "osx");
        }
        if (rule.action === "disallow") {
          if (!rule.os) return false;
          return rule.os.name !== process.platform.replace("win32", "windows").replace("darwin", "osx");
        }
        return true;
      });
      if (!allowed) continue;
    }

    if (lib.downloads?.artifact) {
      const artifact = lib.downloads.artifact;
      const libPath = path.join(librariesDir, artifact.path);
      const libDir = path.dirname(libPath);
      await fs.mkdir(libDir, { recursive: true });

      if (!fsSync.existsSync(libPath)) {
        await downloadFile(artifact.url, libPath, () => {});
      }
      classpath.push(libPath);
    }
  }

  const instanceDir = path.join(INSTANCES_DIR, modpackId);
  const modsDir = path.join(instanceDir, "mods");
  if (fsSync.existsSync(modsDir)) {
    const modFiles = await fs.readdir(modsDir);
    for (const mod of modFiles) {
      if (mod.endsWith(".jar")) {
        classpath.push(path.join(modsDir, mod));
      }
    }
  }

  win?.webContents.send("launch-status", { modpackId, stage: "launching" });

  let javaPath = "java";
  const customJava = path.join(JAVA_DIR, "bin", "java");
  if (fsSync.existsSync(customJava)) javaPath = customJava;

  const mcArgs = buildLaunchArgs(versionJson, {
    username: username || "Player",
    uuid: uuid || "00000000-0000-0000-0000-000000000000",
    accessToken: authToken || "offline",
    gameDir: instanceDir,
    assetsDir,
    assetIndex: assetIndexId,
    version: mcVersion,
    classpath: classpath.join(path.delimiter),
    nativesDir,
    width: "1280",
    height: "720",
  });

  const child = spawn(javaPath, mcArgs, { detached: true, stdio: "ignore" });
  child.unref();

  win?.webContents.send("launch-status", { modpackId, stage: "launched" });
  return { success: true, pid: child.pid };
});

function buildLaunchArgs(versionJson, opts) {
  const jvmArgs = [
    `-Xmx2G`,
    `-Xms512M`,
    `-Djava.library.path=${opts.nativesDir}`,
    `-Dminecraft.launcher.brand=ALaunchi`,
    `-Dminecraft.launcher.version=1.0`,
    `-cp`,
    opts.classpath,
  ];

  const gameArgs = [];
  const rawArgs = versionJson.arguments?.game || versionJson.minecraftArguments?.split(" ") || [];

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
  };

  for (const arg of rawArgs) {
    if (typeof arg === "string") {
      let resolved = arg;
      for (const [k, v] of Object.entries(argMap)) {
        resolved = resolved.replace(k, v);
      }
      gameArgs.push(resolved);
    }
  }

  return [...jvmArgs, versionJson.mainClass, ...gameArgs];
}

ipcMain.handle("mc:check-java", async () => {
  try {
    const { stdout } = await execAsync("java -version");
    return { available: true, version: stdout.trim() };
  } catch {
    const customJava = path.join(JAVA_DIR, "bin", "java");
    return { available: fsSync.existsSync(customJava), version: "custom" };
  }
});

ipcMain.handle("ms:device-code-auth", async () => {
  const clientId = "00000000402b5328";
  return new Promise((resolve, reject) => {
    const postData = `client_id=${clientId}&scope=XboxLive.signin%20offline_access`;
    const options = {
      hostname: "login.microsoftonline.com",
      path: "/consumers/oauth2/v2.0/devicecode",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          shell.openExternal(parsed.verification_uri);
          resolve({
            userCode: parsed.user_code,
            verificationUri: parsed.verification_uri,
            expiresIn: parsed.expires_in,
            interval: parsed.interval,
            deviceCode: parsed.device_code,
          });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
});

ipcMain.handle("ms:poll-token", async (_, { deviceCode }) => {
  const clientId = "00000000402b5328";
  return new Promise((resolve, reject) => {
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:device_code&client_id=${clientId}&device_code=${deviceCode}`;
    const options = {
      hostname: "login.microsoftonline.com",
      path: "/consumers/oauth2/v2.0/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
});

ipcMain.handle("ms:refresh-token", async (_, { refreshToken }) => {
  const clientId = "00000000402b5328";
  return new Promise((resolve, reject) => {
    const postData = `grant_type=refresh_token&client_id=${clientId}&refresh_token=${encodeURIComponent(refreshToken)}&scope=XboxLive.signin%20offline_access`;
    const options = {
      hostname: "login.microsoftonline.com",
      path: "/consumers/oauth2/v2.0/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) {
            resolve({ access_token: parsed.access_token, refresh_token: parsed.refresh_token });
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
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
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${msToken}`,
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    });
    const options = {
      hostname: "user.auth.xboxlive.com",
      path: "/user/authenticate",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Accept: "application/json",
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ xblToken: parsed.Token, userHash: parsed.DisplayClaims?.xui?.[0]?.uhs });
        } catch (e) {
          reject(e);
        }
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
    const options = {
      hostname: "xsts.auth.xboxlive.com",
      path: "/xsts/authorize",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Accept: "application/json",
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ xstsToken: parsed.Token, userHash: parsed.DisplayClaims?.xui?.[0]?.uhs });
        } catch (e) {
          reject(e);
        }
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
    const options = {
      hostname: "api.minecraftservices.com",
      path: "/authentication/login_with_xbox",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ mcToken: parsed.access_token, mcUsername: parsed.username });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
});

ipcMain.handle("ms:mc-profile", async (_, { mcToken }) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.minecraftservices.com",
      path: "/minecraft/profile",
      method: "GET",
      headers: { Authorization: `Bearer ${mcToken}` },
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ username: parsed.name, uuid: parsed.id });
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
});

ipcMain.handle("fs:read-settings", async () => {
  const settingsPath = path.join(APP_DATA_DIR, "settings.json");
  try {
    return JSON.parse(await fs.readFile(settingsPath, "utf8"));
  } catch {
    return {};
  }
});

ipcMain.handle("fs:write-settings", async (_, settings) => {
  const settingsPath = path.join(APP_DATA_DIR, "settings.json");
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
  return { success: true };
});

ipcMain.handle("fs:read-auth", async () => {
  const authPath = path.join(APP_DATA_DIR, "auth.json");
  try {
    return JSON.parse(await fs.readFile(authPath, "utf8"));
  } catch {
    return null;
  }
});

ipcMain.handle("fs:write-auth", async (_, auth) => {
  const authPath = path.join(APP_DATA_DIR, "auth.json");
  await fs.writeFile(authPath, JSON.stringify(auth, null, 2));
  return { success: true };
});

ipcMain.handle("fs:clear-auth", async () => {
  const authPath = path.join(APP_DATA_DIR, "auth.json");
  try { await fs.unlink(authPath); } catch {}
  return { success: true };
});

ipcMain.handle("github:fetch-modpacks", async (_, { repoUrl }) => {
  try {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub URL");
    const [, owner, repo] = match;
    const raw = `https://raw.githubusercontent.com/${owner}/${repo}/main/modpacks.json`;
    return await fetchJson(raw);
  } catch (e) {
    throw new Error("Could not load modpacks from GitHub: " + e.message);
  }
});

ipcMain.handle("github:create-release", async (_, { token, repoUrl, tagName, files }) => {
  return { success: true, message: "Release created (implement with GitHub API)" };
});

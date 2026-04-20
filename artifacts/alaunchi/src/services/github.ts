export interface Modpack {
  id: string;
  name: string;
  description: string;
  minecraftVersion: string;
  loaderType: "forge" | "fabric" | "neoforge" | "vanilla";
  version: string;
  imageUrl: string;
  installed: boolean;
  installedVersion?: string;
  updateAvailable: boolean;
  fileCount: number;
  totalSizeMb: number;
}

export interface ModFile {
  filename: string;
  type: "mod" | "resourcepack" | "shader" | "config" | "bundle";
  sizeMb: number;
  downloadUrl?: string;
}

export interface NewModpackData {
  id: string;
  name: string;
  description: string;
  minecraftVersion: string;
  loaderType: "forge" | "fabric" | "neoforge" | "vanilla";
  version: string;
  imageUrl: string;
}

export interface ParsedRepo {
  owner: string;
  repo: string;
}

export function parseRepo(repoUrl: string): ParsedRepo | null {
  if (!repoUrl) return null;
  const ghMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (ghMatch) return { owner: ghMatch[1], repo: ghMatch[2].replace(/\.git$/, "") };
  const slashMatch = repoUrl.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slashMatch) return { owner: slashMatch[1], repo: slashMatch[2] };
  return null;
}

function rawUrl(owner: string, repo: string, filePath: string, branch = "main"): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
}

async function ghApiFetch(
  path: string,
  token: string,
  opts: RequestInit = {}
): Promise<any> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function getFileContents(
  owner: string,
  repo: string,
  filePath: string,
  token: string
): Promise<{ content: string; sha: string } | null> {
  try {
    const data = await ghApiFetch(`/repos/${owner}/${repo}/contents/${filePath}`, token);
    return { content: atob(data.content.replace(/\n/g, "")), sha: data.sha };
  } catch {
    return null;
  }
}

async function putFileContents(
  owner: string,
  repo: string,
  filePath: string,
  content: string,
  message: string,
  token: string,
  sha?: string
): Promise<void> {
  const body: any = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
  };
  if (sha) body.sha = sha;

  await ghApiFetch(`/repos/${owner}/${repo}/contents/${filePath}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function fetchModpacks(repoUrl: string, token?: string): Promise<Modpack[]> {
  const parsed = parseRepo(repoUrl);
  if (!parsed) return [];

  const { owner, repo } = parsed;

  try {
    let data: Omit<Modpack, "installed" | "installedVersion" | "updateAvailable">[];

    if (token) {
      // Use GitHub API (no CDN cache) when token is available
      const file = await getFileContents(owner, repo, "modpacks.json", token);
      if (!file) return [];
      data = JSON.parse(file.content);
    } else {
      // Fall back to raw URL (may be cached up to 5 min)
      const res = await fetch(rawUrl(owner, repo, "modpacks.json"), { cache: "no-store" });
      if (!res.ok) throw new Error("Not found");
      data = await res.json();
    }

    return data.map((mp) => ({
      ...mp,
      installed: false,
      updateAvailable: false,
    }));
  } catch {
    return [];
  }
}

export async function fetchModpackFiles(repoUrl: string, modpackId: string, token?: string): Promise<ModFile[]> {
  const parsed = parseRepo(repoUrl);
  if (!parsed) return [];

  const { owner, repo } = parsed;
  const filePath = `modpacks/${modpackId}/manifest.json`;

  try {
    if (token) {
      const file = await getFileContents(owner, repo, filePath, token);
      if (!file) return [];
      const data: { files: ModFile[] } = JSON.parse(file.content);
      return data.files ?? [];
    }
    const res = await fetch(rawUrl(owner, repo, filePath), { cache: "no-store" });
    if (!res.ok) return [];
    const data: { files: ModFile[] } = await res.json();
    return data.files ?? [];
  } catch {
    return [];
  }
}

export interface PendingFile {
  file: File;
  type: ModFile["type"];
}

export async function publishUpdate(
  token: string,
  repoUrl: string,
  modpackId: string,
  filesToDelete: string[],
  filesToAdd: PendingFile[],
  newVersion?: string
): Promise<void> {
  const parsed = parseRepo(repoUrl);
  if (!parsed) throw new Error("URL de repositorio no válida.");
  if (!token) throw new Error("Necesitas un token de GitHub con permiso 'repo' en Ajustes.");

  const { owner, repo } = parsed;

  const manifestPath = `modpacks/${modpackId}/manifest.json`;
  const existing = await getFileContents(owner, repo, manifestPath, token);
  let currentFiles: ModFile[] = [];
  if (existing) {
    try {
      currentFiles = JSON.parse(existing.content).files ?? [];
    } catch {}
  }

  const uploadedFiles: ModFile[] = [];

  if (filesToAdd.length > 0) {
    const tagName = `${modpackId}-v${newVersion ?? Date.now()}`;
    let release: any;
    try {
      release = await ghApiFetch(`/repos/${owner}/${repo}/releases/tags/${tagName}`, token);
    } catch {
      release = await ghApiFetch(`/repos/${owner}/${repo}/releases`, token, {
        method: "POST",
        body: JSON.stringify({
          tag_name: tagName,
          name: `${modpackId} v${newVersion ?? "update"}`,
          draft: false,
          prerelease: false,
        }),
      });
    }

    const uploadBase = release.upload_url.replace("{?name,label}", "");

    for (const { file, type } of filesToAdd) {
      const arrayBuffer = await file.arrayBuffer();
      const uploadRes = await fetch(`${uploadBase}?name=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
        body: arrayBuffer,
      });
      if (!uploadRes.ok) throw new Error(`Error subiendo ${file.name}`);
      const asset = await uploadRes.json();
      uploadedFiles.push({
        filename: file.name,
        type,
        sizeMb: parseFloat((file.size / 1_048_576).toFixed(2)),
        downloadUrl: asset.browser_download_url,
      });
    }
  }

  const remainingFiles = currentFiles.filter((f) => !filesToDelete.includes(f.filename));
  const mergedFiles = [...remainingFiles, ...uploadedFiles];

  const newManifest = JSON.stringify({ files: mergedFiles }, null, 2);
  await putFileContents(owner, repo, manifestPath, newManifest, `Update manifest for ${modpackId}`, token, existing?.sha);

  if (newVersion) {
    const modpacksFile = await getFileContents(owner, repo, "modpacks.json", token);
    if (modpacksFile) {
      try {
        const allPacks: any[] = JSON.parse(modpacksFile.content);
        const updated = allPacks.map((p: any) =>
          p.id === modpackId ? { ...p, version: newVersion } : p
        );
        await putFileContents(
          owner,
          repo,
          "modpacks.json",
          JSON.stringify(updated, null, 2),
          `Bump ${modpackId} to v${newVersion}`,
          token,
          modpacksFile.sha
        );
      } catch {}
    }
  }
}

export async function createModpack(
  token: string,
  repoUrl: string,
  data: NewModpackData
): Promise<void> {
  const parsed = parseRepo(repoUrl);
  if (!parsed) throw new Error("URL de repositorio no válida.");
  if (!token) throw new Error("Necesitas un token de GitHub con permiso 'repo' en Ajustes.");

  const { owner, repo } = parsed;

  const modpacksFile = await getFileContents(owner, repo, "modpacks.json", token);
  let allPacks: any[] = [];
  if (modpacksFile) {
    try {
      allPacks = JSON.parse(modpacksFile.content);
    } catch {}
  }

  if (allPacks.find((p: any) => p.id === data.id)) {
    throw new Error(`Ya existe un modpack con el ID "${data.id}".`);
  }

  const newEntry = {
    id: data.id,
    name: data.name,
    description: data.description,
    minecraftVersion: data.minecraftVersion,
    loaderType: data.loaderType,
    version: data.version,
    imageUrl: data.imageUrl,
    fileCount: 0,
    totalSizeMb: 0,
  };

  allPacks.push(newEntry);

  await putFileContents(
    owner,
    repo,
    "modpacks.json",
    JSON.stringify(allPacks, null, 2),
    `Add modpack: ${data.name}`,
    token,
    modpacksFile?.sha
  );

  const emptyManifest = JSON.stringify({ files: [] }, null, 2);
  await putFileContents(
    owner,
    repo,
    `modpacks/${data.id}/manifest.json`,
    emptyManifest,
    `Init manifest for ${data.id}`,
    token
  );
}

function guessFileType(filename: string): ModFile["type"] {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "jar") return "mod";
  if (ext === "zip") {
    if (filename.toLowerCase().includes("shader") || filename.toLowerCase().includes("shad")) return "shader";
    if (filename.toLowerCase().includes("resource") || filename.toLowerCase().includes("texture")) return "resourcepack";
    return "bundle";
  }
  return "config";
}

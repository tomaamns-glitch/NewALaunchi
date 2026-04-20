const eAPI = (window as any).electronAPI;
export const isElectron = !!eAPI;

export interface ModFile {
  filename: string;
  type: "mod" | "resourcepack" | "shader" | "config" | "bundle";
  sizeMb: number;
  downloadUrl?: string;
}

export interface LaunchOptions {
  modpackId: string;
  mcVersion: string;
  loaderType: string;
  authToken: string;
  username: string;
  uuid: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function installModpack(
  modpackId: string,
  files: ModFile[],
  onProgress?: (progress: number) => void,
  modpack?: Record<string, any>
): Promise<void> {
  if (isElectron) {
    return eAPI.installModpack({ modpackId, files, modpack });
  }
  const totalSteps = 20;
  for (let i = 1; i <= totalSteps; i++) {
    await delay(100);
    if (onProgress) onProgress((i / totalSteps) * 100);
  }
}

export async function syncModpack(
  modpackId: string,
  newFiles: ModFile[],
  modpack?: Record<string, any>,
  onProgress?: (progress: number) => void
): Promise<{ downloaded: number }> {
  if (isElectron) {
    return eAPI.syncModpack({ modpackId, newFiles, modpack });
  }
  await delay(500);
  return { downloaded: 0 };
}

export async function launchMinecraft(opts: LaunchOptions): Promise<void> {
  if (isElectron) {
    return eAPI.launchMinecraft(opts);
  }
  await delay(1500);
}

export async function checkForUpdates(
  _modpackId: string,
  latestVersion: string,
  installedVersion?: string
): Promise<boolean> {
  return latestVersion !== installedVersion;
}

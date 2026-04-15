const isElectron = !!(window as any).electronAPI;

export interface ModFile {
  filename: string;
  type: "mod" | "resourcepack" | "shader" | "config";
  sizeMb: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function installModpack(modpackId: string, files: ModFile[], onProgress?: (progress: number) => void): Promise<void> {
  if (isElectron) {
    // return (window as any).electronAPI.installModpack(modpackId, files);
  }
  
  // Simulate install
  const totalSteps = 20;
  for (let i = 1; i <= totalSteps; i++) {
    await delay(100);
    if (onProgress) onProgress((i / totalSteps) * 100);
  }
}

export async function launchMinecraft(modpackId: string, mcVersion: string, loaderType: string): Promise<void> {
  if (isElectron) {
    // return (window as any).electronAPI.launchMinecraft(modpackId, mcVersion, loaderType);
  }
  
  await delay(1500); // Simulate launch prep
}

export async function checkForUpdates(modpackId: string, latestVersion: string, installedVersion?: string): Promise<boolean> {
  if (isElectron) {
    // return (window as any).electronAPI.checkForUpdates(modpackId, latestVersion, installedVersion);
  }
  return latestVersion !== installedVersion;
}

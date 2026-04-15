export interface Modpack {
  id: string;
  name: string;
  description: string;
  minecraftVersion: string;
  loaderType: "forge" | "fabric" | "vanilla";
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
  type: "mod" | "resourcepack" | "shader" | "config";
  sizeMb: number;
}

const MOCK_MODPACKS: Modpack[] = [
  {
    id: "vanilla-plus",
    name: "VANILLA+",
    description: "A polished vanilla experience.",
    minecraftVersion: "1.20.4",
    loaderType: "vanilla",
    version: "1.0.0",
    imageUrl: "/vanilla-plus.png",
    installed: true,
    installedVersion: "1.0.0",
    updateAvailable: false,
    fileCount: 45,
    totalSizeMb: 250
  },
  {
    id: "magic-tech",
    name: "MAGIC & TECH",
    description: "Tech and magic mods for endless exploration.",
    minecraftVersion: "1.20.1",
    loaderType: "fabric",
    version: "2.1.0",
    imageUrl: "/magic-tech.png",
    installed: false,
    updateAvailable: false,
    fileCount: 180,
    totalSizeMb: 600
  },
  {
    id: "survival-pro",
    name: "SURVIVAL PRO",
    description: "Hardcore survival overhaul.",
    minecraftVersion: "1.19.2",
    loaderType: "forge",
    version: "3.5.1",
    imageUrl: "/survival-pro.png",
    installed: true,
    installedVersion: "3.4.0",
    updateAvailable: true,
    fileCount: 120,
    totalSizeMb: 400
  },
  {
    id: "pvp-arena",
    name: "PVP ARENA",
    description: "Competitive PVP pack with optimizations.",
    minecraftVersion: "1.20.4",
    loaderType: "fabric",
    version: "1.2.0",
    imageUrl: "/pvp-arena.png",
    installed: false,
    updateAvailable: false,
    fileCount: 30,
    totalSizeMb: 100
  }
];

export async function fetchModpacks(repoUrl: string): Promise<Modpack[]> {
  // Mock fetch
  await new Promise(r => setTimeout(r, 500));
  return MOCK_MODPACKS;
}

export async function fetchModpackFiles(repoUrl: string, modpackId: string): Promise<ModFile[]> {
  await new Promise(r => setTimeout(r, 300));
  return [
    { filename: "jei-1.20.4.jar", type: "mod", sizeMb: 1.5 },
    { filename: "sodium-1.20.4.jar", type: "mod", sizeMb: 2.0 }
  ];
}

export async function publishUpdate(token: string, repoUrl: string, modpackId: string, filesToDelete: string[], filesToAdd: File[]): Promise<void> {
  console.log(`Publishing update for ${modpackId}...`, { filesToDelete, filesToAdd });
  await new Promise(r => setTimeout(r, 1500));
}

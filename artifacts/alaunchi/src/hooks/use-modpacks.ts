import { create } from "zustand";
import { Modpack, fetchModpacks } from "../services/github";

const eAPI = (window as any).electronAPI;
const isElectron = !!eAPI;

interface InstalledState {
  installed: boolean;
  installedVersion?: string;
}

async function getInstalledState(): Promise<Record<string, InstalledState>> {
  if (isElectron) {
    try {
      const meta: Record<string, any> = await eAPI.getInstalledModpacks();
      const result: Record<string, InstalledState> = {};
      for (const [id, m] of Object.entries(meta)) {
        result[id] = { installed: true, installedVersion: (m as any).version };
      }
      return result;
    } catch {
      return {};
    }
  }
  try {
    const raw = localStorage.getItem("modpackState");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistLocalState(modpacks: Modpack[]) {
  if (isElectron) return;
  const stateToSave = modpacks.reduce(
    (acc, mp) => {
      acc[mp.id] = {
        installed: mp.installed,
        installedVersion: mp.installedVersion,
        updateAvailable: mp.updateAvailable,
      };
      return acc;
    },
    {} as Record<string, any>
  );
  localStorage.setItem("modpackState", JSON.stringify(stateToSave));
}

interface ModpackState {
  modpacks: Modpack[];
  loading: boolean;
  error: string | null;
  loadModpacks: () => Promise<void>;
  updateModpackStatus: (id: string, updates: Partial<Modpack>) => void;
}

export const useModpacks = create<ModpackState>((set, get) => ({
  modpacks: [],
  loading: false,
  error: null,

  loadModpacks: async () => {
    set({ loading: true, error: null });
    const repoUrl = localStorage.getItem("githubRepo") ?? "";

    try {
      const [remoteModpacks, installedState] = await Promise.all([
        fetchModpacks(repoUrl),
        getInstalledState(),
      ]);

      const merged = remoteModpacks.map((mp) => {
        const local = installedState[mp.id];
        if (!local) return mp;
        const updateAvailable =
          local.installed && local.installedVersion !== undefined && local.installedVersion !== mp.version;
        return {
          ...mp,
          installed: local.installed,
          installedVersion: local.installedVersion,
          updateAvailable,
        };
      });

      set({ modpacks: merged, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "Error al cargar modpacks" });
    }
  },

  updateModpackStatus: (id, updates) => {
    const newModpacks = get().modpacks.map((mp) => (mp.id === id ? { ...mp, ...updates } : mp));
    set({ modpacks: newModpacks });
    persistLocalState(newModpacks);
  },
}));

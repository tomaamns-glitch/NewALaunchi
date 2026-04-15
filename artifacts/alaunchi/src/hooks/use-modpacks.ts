import { create } from "zustand";
import { Modpack, fetchModpacks } from "../services/github";

interface ModpackState {
  modpacks: Modpack[];
  loading: boolean;
  loadModpacks: () => Promise<void>;
  updateModpackStatus: (id: string, updates: Partial<Modpack>) => void;
}

export const useModpacks = create<ModpackState>((set, get) => ({
  modpacks: [],
  loading: false,
  loadModpacks: async () => {
    set({ loading: true });
    const repoUrl = localStorage.getItem("githubRepo") || "";
    const modpacks = await fetchModpacks(repoUrl);
    
    // Load local overrides
    const localStateStr = localStorage.getItem("modpackState");
    if (localStateStr) {
      try {
        const localState = JSON.parse(localStateStr);
        const merged = modpacks.map(mp => ({
          ...mp,
          ...(localState[mp.id] || {})
        }));
        set({ modpacks: merged, loading: false });
        return;
      } catch (e) {}
    }
    
    set({ modpacks, loading: false });
  },
  updateModpackStatus: (id, updates) => {
    const newModpacks = get().modpacks.map(mp => mp.id === id ? { ...mp, ...updates } : mp);
    set({ modpacks: newModpacks });
    
    // Save to local storage
    const stateToSave = newModpacks.reduce((acc, mp) => {
      acc[mp.id] = {
        installed: mp.installed,
        installedVersion: mp.installedVersion,
        updateAvailable: mp.updateAvailable
      };
      return acc;
    }, {} as Record<string, any>);
    
    localStorage.setItem("modpackState", JSON.stringify(stateToSave));
  }
}));

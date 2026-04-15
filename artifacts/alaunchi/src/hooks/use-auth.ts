import { create } from "zustand";
import { AuthData, isElectron } from "@/services/auth";

const eAPI = (window as any).electronAPI;

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  uuid: string | null;
  mcToken: string | null;
  setAuth: (data: AuthData) => Promise<void>;
  logout: () => Promise<void>;
  loadPersistedAuth: () => Promise<void>;
}

function loadFromLocalStorage(): Partial<AuthState> {
  try {
    const raw = localStorage.getItem("alaunchi_auth");
    if (!raw) return {};
    const data: AuthData = JSON.parse(raw);
    if (data.expiresAt && data.expiresAt < Date.now()) {
      localStorage.removeItem("alaunchi_auth");
      return {};
    }
    return {
      isAuthenticated: true,
      username: data.username,
      uuid: data.uuid,
      mcToken: data.mcToken,
    };
  } catch {
    return {};
  }
}

export const useAuth = create<AuthState>((set) => ({
  isAuthenticated: false,
  username: null,
  uuid: null,
  mcToken: null,

  loadPersistedAuth: async () => {
    if (isElectron) {
      try {
        const data: AuthData | null = await eAPI.readAuth();
        if (data && data.expiresAt > Date.now()) {
          set({
            isAuthenticated: true,
            username: data.username,
            uuid: data.uuid,
            mcToken: data.mcToken,
          });
          return;
        }
      } catch {}
    } else {
      const persisted = loadFromLocalStorage();
      if (persisted.isAuthenticated) {
        set(persisted as AuthState);
      }
    }
  },

  setAuth: async (data: AuthData) => {
    if (isElectron) {
      await eAPI.writeAuth(data);
    } else {
      localStorage.setItem("alaunchi_auth", JSON.stringify(data));
    }
    set({
      isAuthenticated: true,
      username: data.username,
      uuid: data.uuid,
      mcToken: data.mcToken,
    });
  },

  logout: async () => {
    if (isElectron) {
      await eAPI.clearAuth();
    } else {
      localStorage.removeItem("alaunchi_auth");
    }
    set({ isAuthenticated: false, username: null, uuid: null, mcToken: null });
  },
}));

import { create } from "zustand";
import { AuthData, isElectron, silentRefresh, mcTokenIsExpiredOrNearExpiry } from "@/services/auth";

const eAPI = (window as any).electronAPI;

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  uuid: string | null;
  mcToken: string | null;
  isRefreshing: boolean;
  setAuth: (data: AuthData) => Promise<void>;
  logout: () => Promise<void>;
  loadPersistedAuth: () => Promise<void>;
}

function loadFromLocalStorage(): AuthData | null {
  try {
    const raw = localStorage.getItem("alaunchi_auth");
    if (!raw) return null;
    const data: AuthData = JSON.parse(raw);
    return data;
  } catch {
    return null;
  }
}

function saveToLocalStorage(data: AuthData) {
  localStorage.setItem("alaunchi_auth", JSON.stringify(data));
}

async function readAuthData(): Promise<AuthData | null> {
  if (isElectron) {
    try {
      return await eAPI.readAuth();
    } catch {
      return null;
    }
  }
  return loadFromLocalStorage();
}

async function writeAuthData(data: AuthData): Promise<void> {
  if (isElectron) {
    await eAPI.writeAuth(data);
  } else {
    saveToLocalStorage(data);
  }
}

function applyToState(data: AuthData) {
  return {
    isAuthenticated: true,
    username: data.username,
    uuid: data.uuid,
    mcToken: data.mcToken,
    isRefreshing: false,
  };
}

export const useAuth = create<AuthState>((set) => ({
  isAuthenticated: false,
  username: null,
  uuid: null,
  mcToken: null,
  isRefreshing: false,

  loadPersistedAuth: async () => {
    const data = await readAuthData();
    if (!data) return;

    const refreshTokenStillValid =
      data.msRefreshToken && data.msRefreshTokenExpiresAt > Date.now();

    if (!mcTokenIsExpiredOrNearExpiry(data)) {
      set(applyToState(data));
      return;
    }

    if (!refreshTokenStillValid) {
      return;
    }

    set({ isRefreshing: true });
    const refreshed = await silentRefresh(data);

    if (refreshed) {
      await writeAuthData(refreshed);
      set(applyToState(refreshed));
    } else {
      set({ isRefreshing: false });
    }
  },

  setAuth: async (data: AuthData) => {
    await writeAuthData(data);
    set(applyToState(data));
  },

  logout: async () => {
    if (isElectron) {
      try {
        await eAPI.clearAuth();
      } catch {}
    } else {
      localStorage.removeItem("alaunchi_auth");
    }
    set({ isAuthenticated: false, username: null, uuid: null, mcToken: null, isRefreshing: false });
  },
}));

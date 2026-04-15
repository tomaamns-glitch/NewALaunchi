import { create } from "zustand";

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  login: () => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => {
  const isAuth = localStorage.getItem("auth") === "true";
  const user = localStorage.getItem("username");

  return {
    isAuthenticated: isAuth,
    username: user,
    login: () => {
      localStorage.setItem("auth", "true");
      localStorage.setItem("username", "Steve");
      set({ isAuthenticated: true, username: "Steve" });
    },
    logout: () => {
      localStorage.removeItem("auth");
      localStorage.removeItem("username");
      set({ isAuthenticated: false, username: null });
    },
  };
});

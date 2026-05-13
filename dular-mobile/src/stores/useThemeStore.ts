import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type ThemeMode = "light" | "dark";

type ThemeState = {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "light",
      toggleTheme: () =>
        set((state) => ({ mode: state.mode === "light" ? "dark" : "light" })),
      setTheme: (mode) => set({ mode }),
    }),
    {
      name: "dular-theme",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

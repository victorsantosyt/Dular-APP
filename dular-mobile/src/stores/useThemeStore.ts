import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type ThemeMode = "light" | "dark";

type ThemeState = {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
};

// Dark mode DESATIVADO por hora: o app fica sempre em "light". toggleTheme e
// setTheme são no-ops que mantêm light, e onRehydrateStorage coage qualquer
// valor persistido antigo (ex.: "dark") de volta para light. Para reativar,
// basta restaurar as implementações originais abaixo.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "light",
      toggleTheme: () => set({ mode: "light" }),
      setTheme: () => set({ mode: "light" }),
    }),
    {
      name: "dular-theme",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state && state.mode !== "light") state.mode = "light";
      },
    }
  )
);

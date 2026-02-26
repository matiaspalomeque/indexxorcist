import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Lang = "en" | "es-AR";

interface I18nState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      lang: "en",
      setLang: (lang) => set({ lang }),
    }),
    {
      name: "indexxorcist-lang-v1",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

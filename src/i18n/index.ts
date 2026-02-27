import { useI18nStore } from "../store/i18nStore";
import { translations } from "./translations";

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export function useT() {
  const lang = useI18nStore((s) => s.lang);
  const dict = translations[lang];
  return (key: string, vars?: Record<string, string | number>): string => {
    const str = dict[key] ?? translations.en[key] ?? key;
    return interpolate(str, vars);
  };
}

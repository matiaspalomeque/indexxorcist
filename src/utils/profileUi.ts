import type { Environment } from "../types";

export const ENVIRONMENT_ORDER: Environment[] = [
  "production",
  "staging",
  "uat",
  "development",
  "other",
];

// Tailwind utility classes (rail + chip + tint). Centralized so card,
// badge, and form share the same color language.
export interface EnvVisual {
  rail: string;
  chipBg: string;
  chipText: string;
  chipBorder: string;
  dotText: string;
}

const VISUALS: Record<Environment, EnvVisual> = {
  production: {
    rail: "bg-red-500",
    chipBg: "bg-red-50 dark:bg-red-900/20",
    chipText: "text-red-700 dark:text-red-300",
    chipBorder: "border-red-200 dark:border-red-800",
    dotText: "text-red-500",
  },
  staging: {
    rail: "bg-amber-500",
    chipBg: "bg-amber-50 dark:bg-amber-900/20",
    chipText: "text-amber-700 dark:text-amber-300",
    chipBorder: "border-amber-200 dark:border-amber-800",
    dotText: "text-amber-500",
  },
  uat: {
    rail: "bg-violet-500",
    chipBg: "bg-violet-50 dark:bg-violet-900/20",
    chipText: "text-violet-700 dark:text-violet-300",
    chipBorder: "border-violet-200 dark:border-violet-800",
    dotText: "text-violet-500",
  },
  development: {
    rail: "bg-blue-500",
    chipBg: "bg-blue-50 dark:bg-blue-900/20",
    chipText: "text-blue-700 dark:text-blue-300",
    chipBorder: "border-blue-200 dark:border-blue-800",
    dotText: "text-blue-500",
  },
  other: {
    rail: "bg-gray-300 dark:bg-gray-700",
    chipBg: "bg-gray-100 dark:bg-gray-800",
    chipText: "text-gray-600 dark:text-gray-400",
    chipBorder: "border-gray-200 dark:border-gray-700",
    dotText: "text-gray-400",
  },
};

export function envVisuals(env: Environment | undefined): EnvVisual {
  return VISUALS[env ?? "other"];
}

export function envOrder(env: Environment | undefined): number {
  return ENVIRONMENT_ORDER.indexOf(env ?? "other");
}

// Pure relative-time helper that emits i18n keys + interpolation values.
// Caller resolves to a string via `t(key, values)`.
export type RelativeTimeKey =
  | "profileCard.timeJustNow"
  | "profileCard.timeMinutes"
  | "profileCard.timeHours"
  | "profileCard.timeDays";

export interface RelativeTimeResult {
  key: RelativeTimeKey;
  values?: Record<string, string | number>;
}

export function relativeTime(iso: string, now: number = Date.now()): RelativeTimeResult {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) {
    return { key: "profileCard.timeJustNow" };
  }
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return { key: "profileCard.timeJustNow" };
  if (minutes < 60) return { key: "profileCard.timeMinutes", values: { n: minutes } };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { key: "profileCard.timeHours", values: { n: hours } };
  const days = Math.floor(hours / 24);
  return { key: "profileCard.timeDays", values: { n: days } };
}

export function isSameLocalDay(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function buildConnectionString(p: {
  server: string;
  port: number;
  username: string;
  encrypt: boolean;
  trust_server_certificate: boolean;
}): string {
  const parts = [
    `Server=${p.server}${p.port ? `,${p.port}` : ""}`,
    `User Id=${p.username}`,
    `Encrypt=${p.encrypt ? "true" : "false"}`,
    `TrustServerCertificate=${p.trust_server_certificate ? "true" : "false"}`,
  ];
  return parts.join(";");
}

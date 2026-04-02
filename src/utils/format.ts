import type { DatabaseResult, IndexResult } from "../types";

export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function dbStatusInfo(r: DatabaseResult): { labelKey: string; color: string } {
  if (r.critical_failure)
    return { labelKey: "statusFailed", color: "text-red-500 dark:text-red-400" };
  if (r.interrupted)
    return { labelKey: "statusStopped", color: "text-orange-600 dark:text-orange-400" };
  if (r.manually_skipped)
    return { labelKey: "statusSkipped", color: "text-amber-600 dark:text-amber-400" };
  return { labelKey: "statusDone", color: "text-green-600 dark:text-green-400" };
}

export function indexStatusInfo(r: IndexResult): { labelKey: string; color: string } {
  if (!r.success)
    return { labelKey: "statusFailed", color: "text-red-500 dark:text-red-400" };
  if (r.action === "SKIP")
    return { labelKey: "statusSkipped", color: "text-gray-500 dark:text-gray-400" };
  return { labelKey: "statusDone", color: "text-green-600 dark:text-green-400" };
}

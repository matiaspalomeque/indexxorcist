import { invoke } from "@tauri-apps/api/core";
import { useI18nStore } from "../store/i18nStore";
import { translations } from "../i18n/translations";
import { formatDuration } from "./format";
import type { MaintenanceSummary } from "../types";

let permissionGranted: boolean | null = null;

function supportsNotifications(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function hasGrantedPermission(): Promise<boolean> {
  if (permissionGranted) return true;
  if (!supportsNotifications()) return false;

  try {
    // Returns true (granted), false (denied), or null (prompt — never asked)
    const granted = await invoke<boolean | null>("plugin:notification|is_permission_granted");
    if (granted === true) {
      permissionGranted = true;
    }
    return granted === true;
  } catch (error) {
    console.warn("[Notifications] Failed to check permission:", error);
    return false;
  }
}

export async function prepareNotificationPermission(): Promise<boolean> {
  if (permissionGranted) return true;
  if (!supportsNotifications()) return false;

  try {
    const initial = await invoke<boolean | null>("plugin:notification|is_permission_granted");
    if (initial === true) {
      permissionGranted = true;
      return true;
    }
    // Either denied or never asked — request the system prompt
    const result = await invoke<string>("plugin:notification|request_permission");
    const granted = result === "granted";
    if (granted) {
      permissionGranted = true;
    }
    return granted;
  } catch (error) {
    console.warn("[Notifications] Failed to prepare permission:", error);
    return false;
  }
}

function t(key: string, vars?: Record<string, string | number>): string {
  const lang = useI18nStore.getState().lang;
  const dict = translations[lang];
  const str = dict[key] ?? translations.en[key] ?? key;
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export async function notifyMaintenanceFinished(
  profileName: string,
  summary: MaintenanceSummary,
): Promise<void> {
  if (!(await hasGrantedPermission())) return;

  try {
    await invoke("plugin:notification|notify", {
      options: {
        title: t("notification.finishedTitle"),
        body: t("notification.finishedBody", {
          profile: profileName,
          rebuilt: summary.total_indexes_rebuilt,
          reorganized: summary.total_indexes_reorganized,
          duration: formatDuration(summary.total_duration_secs),
        }),
      },
    });
  } catch (error) {
    console.warn("[Notifications] Failed to send finished notification:", error);
  }
}

export async function notifyMaintenanceError(
  profileName: string,
  message: string,
): Promise<void> {
  if (!(await hasGrantedPermission())) return;

  try {
    await invoke("plugin:notification|notify", {
      options: {
        title: t("notification.errorTitle"),
        body: t("notification.errorBody", { profile: profileName, message }),
      },
    });
  } catch (error) {
    console.warn("[Notifications] Failed to send error notification:", error);
  }
}

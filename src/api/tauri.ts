import { invoke } from "@tauri-apps/api/core";
import type {
  DatabaseResult,
  MaintenanceOptions,
  MaintenanceSummary,
  RunRecord,
  ServerProfile,
} from "../types";

export const getServerProfiles = (): Promise<ServerProfile[]> =>
  invoke("get_server_profiles");

export const saveServerProfile = (profile: ServerProfile): Promise<void> =>
  invoke("save_server_profile", { profile });

export const deleteServerProfile = (id: string): Promise<void> =>
  invoke("delete_server_profile", { id });

export const testConnection = (profile: ServerProfile): Promise<void> =>
  invoke("test_connection", { profile });

export const getDatabases = (profile: ServerProfile): Promise<string[]> =>
  invoke("get_databases", { profile });

export const runMaintenance = (
  profile: ServerProfile,
  databases: string[],
  options: MaintenanceOptions
): Promise<void> => invoke("run_maintenance", { profile, databases, options });

export const pauseMaintenance = (profileId: string): Promise<void> =>
  invoke("pause_maintenance", { profileId });

export const resumeMaintenance = (profileId: string): Promise<void> =>
  invoke("resume_maintenance", { profileId });

export const skipDatabase = (profileId: string): Promise<void> =>
  invoke("skip_database", { profileId });

export const stopMaintenance = (profileId: string): Promise<void> =>
  invoke("stop_maintenance", { profileId });

export const getRunHistory = (profileId?: string, limit?: number): Promise<RunRecord[]> =>
  invoke("get_run_history", {
    ...(profileId != null ? { profileId } : {}),
    ...(limit != null ? { limit } : {}),
  });

export const clearRunHistory = (profileId?: string): Promise<void> =>
  invoke("clear_run_history", profileId != null ? { profileId } : {});

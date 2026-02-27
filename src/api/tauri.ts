import { invoke } from "@tauri-apps/api/core";
import type {
  MaintenanceOptions,
  RunRecord,
  ServerProfile,
} from "../types";

export const getServerProfiles = (): Promise<ServerProfile[]> =>
  invoke("get_server_profiles");

export const saveServerProfile = (profile: ServerProfile): Promise<void> =>
  invoke("save_server_profile", { profile });

export const deleteServerProfile = (id: string): Promise<void> =>
  invoke("delete_server_profile", { id });

// Credentials are loaded server-side — only the profile ID crosses the IPC boundary.
export const testConnection = (profileId: string): Promise<void> =>
  invoke("test_connection", { profileId });

export const getDatabases = (profileId: string): Promise<string[]> =>
  invoke("get_databases", { profileId });

export const runMaintenance = (
  profileId: string,
  databases: string[],
  options: MaintenanceOptions
): Promise<void> => invoke("run_maintenance", { profileId, databases, options });

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

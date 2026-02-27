import { create } from "zustand";
import type {
  DatabaseCardData,
  DbCompletePayload,
  DbStartPayload,
  IndexActionPayload,
  IndexCompletePayload,
  IndexDetail,
  IndexFoundPayload,
  MaintenanceFinishedPayload,
  MaintenanceSummary,
  RunState,
  ServerProfile,
} from "../types";

export interface ProfileRun {
  profileId: string;
  profileName: string;
  profileServer: string;
  runState: RunState;
  databases: DatabaseCardData[];
  currentDbIndex: number;
  totalDbs: number;
  summary: MaintenanceSummary | null;
  startedAtMs: number;
  isParallel: boolean;
}


interface MaintenanceState {
  byProfile: Record<string, ProfileRun>;
  startRun: (profile: ServerProfile, databaseNames: string[], isParallel: boolean) => void;
  setRunState: (profileId: string, runState: RunState) => void;
  setDatabaseState: (profileId: string, name: string, state: DatabaseCardData["state"]) => void;
  resetProfile: (profileId: string) => void;

  // Event handlers — called from useMaintenanceEvents
  handleDbStart: (payload: DbStartPayload) => void;
  handleIndexFound: (payload: IndexFoundPayload) => void;
  handleIndexAction: (payload: IndexActionPayload) => void;
  handleIndexComplete: (payload: IndexCompletePayload) => void;
  handleDbComplete: (payload: DbCompletePayload) => void;
  handleFinished: (payload: MaintenanceFinishedPayload) => void;
}

function makeEmptyCard(name: string): DatabaseCardData {
  return {
    name,
    state: "queued",
    indexes: [],
    indexes_processed: 0,
    indexes_rebuilt: 0,
    indexes_reorganized: 0,
    indexes_skipped: 0,
    duration_secs: 0,
    errors: [],
  };
}

function createRun(profileId: string): ProfileRun {
  return {
    profileId,
    profileName: "Unknown Profile",
    profileServer: "",
    runState: "idle",
    databases: [],
    currentDbIndex: 0,
    totalDbs: 0,
    summary: null,
    startedAtMs: Date.now(),
    isParallel: false,
  };
}

function ensureRun(byProfile: Record<string, ProfileRun>, profileId: string): ProfileRun {
  return byProfile[profileId] ?? createRun(profileId);
}

function updateDb(
  databases: DatabaseCardData[],
  name: string,
  updater: (db: DatabaseCardData) => DatabaseCardData
): DatabaseCardData[] {
  const found = databases.some((db) => db.name === name);
  if (!found) {
    return [...databases, updater(makeEmptyCard(name))];
  }

  return databases.map((db) => (db.name === name ? updater(db) : db));
}

function updateIndex(
  indexes: IndexDetail[],
  schema: string,
  table: string,
  index: string,
  updater: (idx: IndexDetail) => IndexDetail
): IndexDetail[] {
  return indexes.map((idx) =>
    idx.schema_name === schema && idx.table_name === table && idx.index_name === index
      ? updater(idx)
      : idx
  );
}

function withRun(
  byProfile: Record<string, ProfileRun>,
  profileId: string,
  updater: (run: ProfileRun) => ProfileRun
): Record<string, ProfileRun> {
  const current = ensureRun(byProfile, profileId);
  return {
    ...byProfile,
    [profileId]: updater(current),
  };
}

export const useMaintenanceStore = create<MaintenanceState>((set) => ({
  byProfile: {},

  startRun: (profile, databaseNames, isParallel) =>
    set((state) => ({
      byProfile: {
        ...state.byProfile,
        [profile.id]: {
          profileId: profile.id,
          profileName: profile.name,
          profileServer: profile.server,
          runState: "running",
          databases: databaseNames.map(makeEmptyCard),
          currentDbIndex: 0,
          totalDbs: databaseNames.length,
          summary: null,
          startedAtMs: Date.now(),
          isParallel,
        },
      },
    })),

  setRunState: (profileId, runState) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, profileId, (run) => ({
        ...run,
        runState,
      })),
    })),

  setDatabaseState: (profileId, name, dbState) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, profileId, (run) => ({
        ...run,
        databases: updateDb(run.databases, name, (db) => ({ ...db, state: dbState })),
      })),
    })),

  resetProfile: (profileId) =>
    set((state) => {
      const { [profileId]: _deleted, ...rest } = state.byProfile;
      return { byProfile: rest };
    }),

  handleDbStart: (payload) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, payload.profile_id, (run) => ({
        ...run,
        runState: "running",
        currentDbIndex: payload.current,
        totalDbs: payload.total,
        databases: updateDb(run.databases, payload.db_name, (db) => ({
          ...db,
          state: "running",
        })),
      })),
    })),

  handleIndexFound: (payload) =>
    set((state) => {
      const detail: IndexDetail = { ...payload.index, status: "pending" };
      return {
        byProfile: withRun(state.byProfile, payload.profile_id, (run) => ({
          ...run,
          databases: updateDb(run.databases, payload.index.database_name, (db) => ({
            ...db,
            indexes: db.indexes.some(
              (idx) =>
                idx.schema_name === payload.index.schema_name &&
                idx.table_name === payload.index.table_name &&
                idx.index_name === payload.index.index_name
            )
              ? db.indexes
              : [...db.indexes, detail],
          })),
        })),
      };
    }),

  handleIndexAction: (payload) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, payload.profile_id, (run) => ({
        ...run,
        databases: updateDb(run.databases, payload.db_name, (db) => ({
          ...db,
          indexes: updateIndex(
            db.indexes,
            payload.schema_name,
            payload.table_name,
            payload.index_name,
            (idx) => ({ ...idx, action: payload.action, status: "processing" })
          ),
        })),
      })),
    })),

  handleIndexComplete: (payload) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, payload.profile_id, (run) => ({
        ...run,
        databases: updateDb(run.databases, payload.db_name, (db) => {
          const isSkip = payload.action === "SKIP";
          return {
            ...db,
            indexes_processed: db.indexes_processed + 1,
            indexes_rebuilt:
              payload.action === "REBUILD" && payload.success
                ? db.indexes_rebuilt + 1
                : db.indexes_rebuilt,
            indexes_reorganized:
              payload.action === "REORGANIZE" && payload.success
                ? db.indexes_reorganized + 1
                : db.indexes_reorganized,
            indexes_skipped: isSkip ? db.indexes_skipped + 1 : db.indexes_skipped,
            indexes: updateIndex(
              db.indexes,
              payload.schema_name,
              payload.table_name,
              payload.index_name,
              (idx) => ({
                ...idx,
                status: isSkip ? "skipped" : payload.success ? "done" : "error",
                action: payload.action,
                duration_secs: payload.duration_secs,
                retry_attempts: payload.retry_attempts,
                error: payload.error,
              })
            ),
          };
        }),
      })),
    })),

  handleDbComplete: (payload) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, payload.profile_id, (run) => ({
        ...run,
        databases: updateDb(run.databases, payload.result.database_name, (db) => ({
          ...db,
          state: payload.result.manually_skipped
            ? "skipped"
            : payload.result.critical_failure
            ? "error"
            : "done",
          indexes_processed: payload.result.indexes_processed,
          indexes_rebuilt: payload.result.indexes_rebuilt,
          indexes_reorganized: payload.result.indexes_reorganized,
          indexes_skipped: payload.result.indexes_skipped,
          duration_secs: payload.result.total_duration_secs,
          errors: payload.result.errors,
        })),
      })),
    })),

  handleFinished: (payload) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, payload.profile_id, (run) => {
        const total = run.totalDbs || payload.summary.databases_processed;
        const nextState: RunState =
          payload.summary.databases_processed < total ? "stopped" : "finished";
        return {
          ...run,
          summary: payload.summary,
          runState: nextState,
        };
      }),
    })),
}));

export function isActiveRunState(runState: RunState): boolean {
  return runState === "running" || runState === "paused";
}

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

interface DatabaseCardDataInternal extends DatabaseCardData {
  indexLookup: Record<string, number>;
}

interface ProfileRun {
  profileId: string;
  profileName: string;
  profileServer: string;
  runState: RunState;
  databases: DatabaseCardDataInternal[];
  dbLookup: Record<string, number>;
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

function indexKey(schema: string, table: string, index: string): string {
  return `${schema}\u0000${table}\u0000${index}`;
}

function makeEmptyCard(name: string): DatabaseCardDataInternal {
  return {
    name,
    state: "queued",
    indexes: [],
    indexLookup: {},
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
    dbLookup: {},
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

function updateAt<T>(items: T[], idx: number, next: T): T[] {
  const cloned = items.slice();
  cloned[idx] = next;
  return cloned;
}

function ensureDb(
  run: ProfileRun,
  name: string,
): { run: ProfileRun; db: DatabaseCardDataInternal; dbIdx: number } {
  const existingIdx = run.dbLookup[name];
  if (existingIdx != null) {
    return { run, db: run.databases[existingIdx], dbIdx: existingIdx };
  }

  const dbIdx = run.databases.length;
  const db = makeEmptyCard(name);
  const nextRun: ProfileRun = {
    ...run,
    databases: [...run.databases, db],
    dbLookup: { ...run.dbLookup, [name]: dbIdx },
  };

  return { run: nextRun, db, dbIdx };
}

function replaceDb(run: ProfileRun, dbIdx: number, nextDb: DatabaseCardDataInternal): ProfileRun {
  if (run.databases[dbIdx] === nextDb) {
    return run;
  }
  return {
    ...run,
    databases: updateAt(run.databases, dbIdx, nextDb),
  };
}

function withDb(
  run: ProfileRun,
  dbName: string,
  updater: (db: DatabaseCardDataInternal) => DatabaseCardDataInternal
): ProfileRun {
  const ensured = ensureDb(run, dbName);
  const nextDb = updater(ensured.db);
  return replaceDb(ensured.run, ensured.dbIdx, nextDb);
}

function addIndexIfMissing(
  db: DatabaseCardDataInternal,
  detail: IndexDetail
): DatabaseCardDataInternal {
  const key = indexKey(detail.schema_name, detail.table_name, detail.index_name);
  if (db.indexLookup[key] != null) {
    return db;
  }
  const position = db.indexes.length;
  return {
    ...db,
    indexes: [...db.indexes, detail],
    indexLookup: { ...db.indexLookup, [key]: position },
  };
}

function updateIndexIfFound(
  db: DatabaseCardDataInternal,
  schema: string,
  table: string,
  index: string,
  updater: (idx: IndexDetail) => IndexDetail
): DatabaseCardDataInternal {
  const idxPos = db.indexLookup[indexKey(schema, table, index)];
  if (idxPos == null) {
    return db;
  }

  const prev = db.indexes[idxPos];
  const next = updater(prev);
  if (next === prev) {
    return db;
  }

  return {
    ...db,
    indexes: updateAt(db.indexes, idxPos, next),
  };
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

  startRun: (profile, databaseNames, isParallel) => {
    const databases = databaseNames.map(makeEmptyCard);
    const dbLookup: Record<string, number> = {};
    databases.forEach((db, idx) => {
      dbLookup[db.name] = idx;
    });

    set((state) => ({
      byProfile: {
        ...state.byProfile,
        [profile.id]: {
          profileId: profile.id,
          profileName: profile.name,
          profileServer: profile.server,
          runState: "running",
          databases,
          dbLookup,
          currentDbIndex: 0,
          totalDbs: databaseNames.length,
          summary: null,
          startedAtMs: Date.now(),
          isParallel,
        },
      },
    }));
  },

  setRunState: (profileId, runState) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, profileId, (run) => ({
        ...run,
        runState,
      })),
    })),

  setDatabaseState: (profileId, name, dbState) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, profileId, (run) =>
        withDb(run, name, (db) => ({ ...db, state: dbState }))
      ),
    })),

  resetProfile: (profileId) =>
    set((state) => {
      const { [profileId]: _deleted, ...rest } = state.byProfile;
      return { byProfile: rest };
    }),

  handleDbStart: (payload) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, payload.profile_id, (run) => {
        const nextRun = withDb(run, payload.db_name, (db) => ({ ...db, state: "running" }));
        return {
          ...nextRun,
          runState: "running",
          currentDbIndex: payload.current,
          totalDbs: payload.total,
        };
      }),
    })),

  handleIndexFound: (payload) =>
    set((state) => {
      const detail: IndexDetail = { ...payload.index, status: "pending" };
      return {
        byProfile: withRun(state.byProfile, payload.profile_id, (run) =>
          withDb(run, payload.index.database_name, (db) => addIndexIfMissing(db, detail))
        ),
      };
    }),

  handleIndexAction: (payload) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, payload.profile_id, (run) =>
        withDb(run, payload.db_name, (db) =>
          updateIndexIfFound(
            db,
            payload.schema_name,
            payload.table_name,
            payload.index_name,
            (idx) => ({ ...idx, action: payload.action, status: "processing" })
          )
        )
      ),
    })),

  handleIndexComplete: (payload) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, payload.profile_id, (run) =>
        withDb(run, payload.db_name, (db) => {
          const isSkip = payload.action === "SKIP";
          const dbWithIndex = updateIndexIfFound(
            db,
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
          );

          return {
            ...dbWithIndex,
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
          };
        })
      ),
    })),

  handleDbComplete: (payload) =>
    set((state) => ({
      byProfile: withRun(state.byProfile, payload.profile_id, (run) =>
        withDb(run, payload.result.database_name, (db) => ({
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
        }))
      ),
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

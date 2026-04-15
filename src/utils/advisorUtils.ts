import type { DatabaseResult, RunRecord } from "../types";

export type UrgencyLevel = "high" | "medium" | "low" | "unknown";

export interface DbAdvisorInfo {
  level: UrgencyLevel;
  score: number;
  daysSince: number | null;
  rebuildRatio: number | null;
  lastRunDate: string | null;
  runCount: number;
  avgDurationSecs: number | null;
}

/**
 * Compute urgency info for a single database from its run history.
 * Score formula: rebuild rate (60%) + staleness (40%), max 100.
 */
export function computeDbAdvisorInfo(
  dbName: string,
  profileRecords: RunRecord[]
): DbAdvisorInfo {
  // Single pass: collect matching (run, result) pairs, avoiding repeated .find() per record
  const dbRuns: Array<{ started_at: string; result: DatabaseResult }> = [];
  for (const r of profileRecords) {
    const result = r.database_results.find((dr) => dr.database_name === dbName);
    if (result) dbRuns.push({ started_at: r.started_at, result });
  }
  dbRuns.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

  if (dbRuns.length === 0) {
    return {
      level: "unknown",
      score: 0,
      daysSince: null,
      rebuildRatio: null,
      lastRunDate: null,
      runCount: 0,
      avgDurationSecs: null,
    };
  }

  const { started_at: lastStartedAt, result: lastResult } = dbRuns[0];
  const daysSince = (Date.now() - new Date(lastStartedAt).getTime()) / 86_400_000;
  const processed = lastResult.indexes_processed;
  const rebuildRatio = processed > 0 ? lastResult.indexes_rebuilt / processed : 0;

  const avgDurationSecs =
    dbRuns.reduce((sum, { result }) => sum + result.total_duration_secs, 0) / dbRuns.length;

  const daysFactor = Math.min(daysSince / 14, 1) * 40;
  const rebuildFactor = rebuildRatio * 60;
  const score = Math.round(daysFactor + rebuildFactor);

  const level: UrgencyLevel = score >= 50 ? "high" : score >= 22 ? "medium" : "low";

  return {
    level,
    score,
    daysSince,
    rebuildRatio,
    lastRunDate: lastStartedAt,
    runCount: dbRuns.length,
    avgDurationSecs,
  };
}

/**
 * Estimate the total run duration for a set of selected databases.
 * Uses average durations from history; scales for parallel runs.
 * Returns null when no historical data is available.
 */
export function estimateRunDuration(
  selectedDbs: string[],
  dbInfoMap: Map<string, DbAdvisorInfo>,
  parallel: boolean,
  maxParallel: number
): number | null {
  if (selectedDbs.length === 0) return null;

  const known = selectedDbs
    .map((db) => dbInfoMap.get(db)?.avgDurationSecs ?? null)
    .filter((d): d is number => d !== null);

  if (known.length === 0) return null;

  // Scale: if only some databases have history, extrapolate proportionally
  const avgKnown = known.reduce((a, b) => a + b, 0) / known.length;
  const totalSerial = avgKnown * selectedDbs.length;

  if (!parallel || maxParallel <= 1 || selectedDbs.length <= 1) return totalSerial;

  // Model parallel as: total / concurrency with a 15% coordination overhead
  const concurrency = Math.min(maxParallel, selectedDbs.length);
  return (totalSerial / concurrency) * 1.15;
}

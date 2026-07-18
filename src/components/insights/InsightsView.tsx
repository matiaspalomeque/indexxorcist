import { Activity, BarChart2, Clock, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useT } from "../../i18n";
import { Select } from "../shared/Select";
import { useHistoryStore } from "../../store/historyStore";
import type { RunRecord } from "../../types";
import { formatDuration } from "../../utils/format";

// ─── Types ───────────────────────────────────────────────────────────────────

type CellHealth = 0 | 1 | 2 | 3; // 0=no run, 1=low frag, 2=med frag, 3=high/critical

type CalendarCell = {
  date: Date;
  health: CellHealth;
  runs: number;
  avgFrag: number;
} | null; // null = future date

type Offender = { server: string; db: string; indexPath: string; count: number };

// ─── Data hooks ──────────────────────────────────────────────────────────────

function useCalendarData(records: RunRecord[]) {
  return useMemo(() => {
    const dayData = new Map<string, { health: CellHealth; runs: number; avgFrag: number }>();

    for (const record of records) {
      const dateKey = record.started_at.slice(0, 10);

      let totalFrag = 0, fragCount = 0, hasCritical = false;
      for (const db of record.database_results) {
        if (db.critical_failure) hasCritical = true;
        for (const idx of db.index_results) {
          totalFrag += idx.fragmentation_percent;
          fragCount++;
        }
      }
      const avgFrag = fragCount > 0 ? totalFrag / fragCount : 0;

      const existing = dayData.get(dateKey);
      if (!existing) {
        const health: CellHealth = hasCritical || avgFrag > 30 ? 3 : avgFrag > 15 ? 2 : 1;
        dayData.set(dateKey, { health, runs: 1, avgFrag });
      } else {
        const newAvg = (existing.avgFrag * existing.runs + avgFrag) / (existing.runs + 1);
        const health: CellHealth =
          existing.health === 3 || hasCritical || newAvg > 30 ? 3
          : existing.health === 2 || newAvg > 15 ? 2
          : 1;
        dayData.set(dateKey, { health, runs: existing.runs + 1, avgFrag: newAvg });
      }
    }

    // Build 52 weeks × 7 days grid aligned to Monday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay(); // 0=Sun
    const toMonday = dow === 0 ? 6 : dow - 1;
    const gridStart = new Date(today);
    gridStart.setDate(today.getDate() - toMonday - 51 * 7);

    const weeks: CalendarCell[][] = [];
    const monthLabels: Array<{ col: number; label: string }> = [];

    for (let w = 0; w < 52; w++) {
      const monday = new Date(gridStart);
      monday.setDate(gridStart.getDate() + w * 7);

      if (w > 0) {
        const prevMonday = new Date(gridStart);
        prevMonday.setDate(gridStart.getDate() + (w - 1) * 7);
        if (monday.getMonth() !== prevMonday.getMonth()) {
          monthLabels.push({
            col: w,
            label: monday.toLocaleDateString("en-US", { month: "short" }),
          });
        }
      }

      const week: CalendarCell[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(monday);
        cellDate.setDate(monday.getDate() + d);
        if (cellDate > today) {
          week.push(null);
        } else {
          const dk = cellDate.toISOString().slice(0, 10);
          const data = dayData.get(dk);
          week.push({
            date: cellDate,
            health: data?.health ?? 0,
            runs: data?.runs ?? 0,
            avgFrag: data?.avgFrag ?? 0,
          });
        }
      }
      weeks.push(week);
    }

    return { weeks, monthLabels };
  }, [records]);
}

function useChronicOffenders(records: RunRecord[]): Offender[] {
  return useMemo(() => {
    const map = new Map<string, Offender>();
    for (const record of records) {
      for (const db of record.database_results) {
        for (const idx of db.index_results) {
          if (idx.action === "REBUILD") {
            const indexPath = `${idx.schema_name}.${idx.table_name}.${idx.index_name}`;
            const key = `${record.server}\0${db.database_name}\0${indexPath}`;
            const existing = map.get(key);
            if (!existing) {
              map.set(key, { server: record.server, db: db.database_name, indexPath, count: 1 });
            } else {
              map.set(key, { ...existing, count: existing.count + 1 });
            }
          }
        }
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [records]);
}

function useDbStats(records: RunRecord[]) {
  return useMemo(() => {
    const stats = new Map<string, {
      server: string; db: string; runs: number; rebuilt: number; reorganized: number;
      totalFrag: number; fragCount: number;
    }>();

    for (const record of records) {
      for (const db of record.database_results) {
        let totalFrag = 0, fragCount = 0;
        for (const idx of db.index_results) {
          totalFrag += idx.fragmentation_percent;
          fragCount++;
        }
        const key = `${record.server}\0${db.database_name}`;
        const existing = stats.get(key);
        if (!existing) {
          stats.set(key, {
            server: record.server, db: db.database_name, runs: 1,
            rebuilt: db.indexes_rebuilt, reorganized: db.indexes_reorganized,
            totalFrag, fragCount,
          });
        } else {
          stats.set(key, {
            ...existing,
            runs: existing.runs + 1,
            rebuilt: existing.rebuilt + db.indexes_rebuilt,
            reorganized: existing.reorganized + db.indexes_reorganized,
            totalFrag: existing.totalFrag + totalFrag,
            fragCount: existing.fragCount + fragCount,
          });
        }
      }
    }

    return [...stats.values()]
      .sort((a, b) => (b.rebuilt + b.reorganized) - (a.rebuilt + a.reorganized))
      .slice(0, 6)
      .map(s => ({ ...s, avgFrag: s.fragCount > 0 ? s.totalFrag / s.fragCount : 0 }));
  }, [records]);
}

// ─── Cell helpers ─────────────────────────────────────────────────────────────

function cellClass(cell: CalendarCell): string {
  if (cell === null) return "invisible pointer-events-none";
  if (cell.health === 0) return "bg-gray-100 dark:bg-gray-800";
  if (cell.health === 1) return "bg-emerald-400 dark:bg-emerald-500";
  if (cell.health === 2) return "bg-amber-400 dark:bg-amber-500";
  return "bg-red-400 dark:bg-red-500";
}

function cellTooltip(cell: CalendarCell): string {
  if (!cell) return "";
  const d = cell.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (cell.health === 0) return `${d} — no run`;
  return `${d}\n${cell.runs} run${cell.runs !== 1 ? "s" : ""} · avg ${cell.avgFrag.toFixed(1)}% fragmentation`;
}

function fragBadgeClass(avgFrag: number): string {
  if (avgFrag <= 15) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400";
  if (avgFrag <= 30) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InsightsView() {
  const t = useT();
  const { records, loading, loadHistory } = useHistoryStore();
  const [selectedServer, setSelectedServer] = useState<string>("");

  useEffect(() => {
    void loadHistory(undefined, 500);
  }, [loadHistory]);

  const servers = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) if (r.server) set.add(r.server);
    return [...set].sort();
  }, [records]);

  const filteredRecords = useMemo(() =>
    selectedServer ? records.filter(r => r.server === selectedServer) : records,
    [records, selectedServer]
  );

  const { weeks, monthLabels } = useCalendarData(filteredRecords);
  const offenders = useChronicOffenders(filteredRecords);
  const dbStats = useDbStats(filteredRecords);

  const totalRuns = filteredRecords.length;
  const totalFixed = filteredRecords.reduce((s, r) => s + r.total_indexes_rebuilt + r.total_indexes_reorganized, 0);
  const avgDuration = filteredRecords.length > 0
    ? filteredRecords.reduce((s, r) => s + r.total_duration_secs, 0) / filteredRecords.length
    : 0;

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-gray-400">
        {t("insights.loading")}
      </div>
    );
  }

  if (!loading && records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <BarChart2 size={40} className="text-gray-300 dark:text-gray-700" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("insights.empty")}</p>
      </div>
    );
  }

  const offenderMax = offenders[0]?.count ?? 1;
  const multiServer = !selectedServer;

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5 lg:space-y-6">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t("insights.title")}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("insights.subtitle")}</p>
          </div>
          {servers.length > 1 && (
            <div className="flex items-center gap-2 flex-shrink-0 sm:mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">{t("insights.filterServer")}</span>
              <Select
                value={selectedServer}
                options={[
                  { value: "", label: t("insights.filterAllServers") },
                  ...servers.map(s => ({ value: s, label: s })),
                ]}
                onChange={setSelectedServer}
                aria-label={t("insights.filterServer")}
                align="right"
              />
            </div>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
          <StatCard icon={<Activity size={16} />} label={t("insights.statRuns")} value={String(totalRuns)} />
          <StatCard icon={<Zap size={16} />} label={t("insights.statFixed")} value={String(totalFixed)} />
          <StatCard icon={<Clock size={16} />} label={t("insights.statAvgDuration")} value={formatDuration(avgDuration)} />
        </div>

        {/* Maintenance calendar */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex flex-col items-start justify-between gap-3 mb-5 sm:flex-row">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t("insights.calendarTitle")}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t("insights.calendarSubtitle")}</p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-600">
            <span>{t("insights.legendLow")}</span>
            <div className="flex gap-0.5 items-center">
              <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
              <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-500" />
              <div className="w-3 h-3 rounded-sm bg-amber-400 dark:bg-amber-500" />
              <div className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-500" />
            </div>
            <span>{t("insights.legendHigh")}</span>
          </div>
          </div>

          <div className="overflow-x-auto">
            <div style={{ minWidth: "fit-content" }}>
            {/* Month labels */}
            <div className="flex mb-1" style={{ marginLeft: "18px", gap: "2px" }}>
              {weeks.map((_, wi) => {
                const label = monthLabels.find(m => m.col === wi);
                return (
                  <div key={wi} style={{ width: "12px", flexShrink: 0 }}
                    className="text-2xs text-gray-400 dark:text-gray-600 overflow-visible whitespace-nowrap">
                    {label?.label ?? ""}
                  </div>
                );
              })}
            </div>

            {/* Day labels + grid */}
            <div className="flex" style={{ gap: "2px" }}>
              {/* Day-of-week labels */}
              <div className="flex flex-col mr-1" style={{ gap: "2px" }}>
                {(["M", "", "W", "", "F", "", "S"] as const).map((label, i) => (
                  <div key={i} style={{ width: "12px", height: "12px" }}
                    className="text-2xs text-gray-400 dark:text-gray-600 flex items-center justify-end leading-none">
                    {label}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap: "2px" }}>
                  {week.map((cell, di) => (
                    <div
                      key={di}
                      style={{ width: "12px", height: "12px" }}
                      className={`rounded-sm cursor-default hover:ring-1 hover:ring-gray-400/50 transition-shadow ${cellClass(cell)}`}
                      title={cellTooltip(cell)}
                    />
                  ))}
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>

        {/* Bottom two-column section */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 lg:gap-6">
          {/* Chronic Offenders */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t("insights.offendersTitle")}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-4">{t("insights.offendersSubtitle")}</p>

          {offenders.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-600 italic">{t("insights.offendersEmpty")}</p>
          ) : (
            <div className="space-y-1">
              {offenders.map((o) => (
                <div key={`${o.server}\0${o.db}\0${o.indexPath}`} className="relative rounded overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-50 dark:bg-blue-900/20 rounded"
                    style={{ width: `${(o.count / offenderMax) * 100}%` }}
                  />
                  <div className="relative flex items-center justify-between px-2 py-1.5 gap-2">
                    <div className="min-w-0">
                      {multiServer && (
                        <p className="text-2xs text-gray-400 dark:text-gray-500 leading-tight truncate">{o.server} › {o.db}</p>
                      )}
                      <span
                        className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate block"
                        title={`${o.db} › ${o.indexPath}`}
                      >
                        {!multiServer && `${o.db} › `}{o.indexPath}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">
                      {o.count}×
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>

          {/* Database Activity */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t("insights.dbTitle")}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-4">{t("insights.dbSubtitle")}</p>

          {dbStats.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-600 italic">{t("insights.dbEmpty")}</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {dbStats.map(s => (
                <div key={`${s.server}\0${s.db}`} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-medium text-gray-900 dark:text-white truncate">{s.db}</p>
                    <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {multiServer && (
                        <span className="text-gray-400 dark:text-gray-500">{s.server} · </span>
                      )}
                      {t("insights.dbRuns", { count: s.runs })} · {t("insights.dbFixed", { count: s.rebuilt + s.reorganized, rebuilt: s.rebuilt })}
                    </p>
                  </div>
                  {s.fragCount > 0 && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${fragBadgeClass(s.avgFrag)}`}>
                      {s.avgFrag.toFixed(1)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3.5 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">{value}</p>
      </div>
    </div>
  );
}

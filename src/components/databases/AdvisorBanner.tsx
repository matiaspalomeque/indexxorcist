import { Zap } from "lucide-react";
import { useMemo } from "react";
import { useT } from "../../i18n";
import type { DbAdvisorInfo, UrgencyLevel } from "../../utils/advisorUtils";

type UrgencyConfig = {
  dotClass: string;
  badgeClass: string;
  rowBadgeClass: string;
  labelKey: string;
};

export const URGENCY: Record<UrgencyLevel, UrgencyConfig> = {
  high: {
    dotClass: "bg-red-500",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    rowBadgeClass:
      "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-900/50",
    labelKey: "advisor.urgencyHigh",
  },
  medium: {
    dotClass: "bg-amber-400",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    rowBadgeClass:
      "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-900/50",
    labelKey: "advisor.urgencyMedium",
  },
  low: {
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    rowBadgeClass:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-900/50",
    labelKey: "advisor.urgencyLow",
  },
  unknown: {
    dotClass: "bg-gray-400 dark:bg-gray-600",
    badgeClass: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    rowBadgeClass:
      "bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-600 ring-1 ring-gray-200 dark:ring-gray-700",
    labelKey: "advisor.urgencyUnknown",
  },
};

export function DbAgeBadge({ info }: { info: DbAdvisorInfo }) {
  const t = useT();
  const cfg = URGENCY[info.level];

  const label =
    info.daysSince === null
      ? "?"
      : info.daysSince < 1
      ? "0d"
      : `${Math.floor(info.daysSince)}d`;

  const parts: string[] = [];
  if (info.daysSince !== null) {
    parts.push(
      info.daysSince < 1
        ? t("advisor.today")
        : t("advisor.daysAgo", { days: Math.floor(info.daysSince) })
    );
  } else {
    parts.push(t("advisor.noMaintenance"));
  }
  if (info.rebuildRatio !== null && info.runCount > 0) {
    parts.push(t("advisor.rebuildRate", { pct: Math.round(info.rebuildRatio * 100) }));
  }
  if (info.runCount > 0) {
    parts.push(t("advisor.runCount", { count: info.runCount }));
  }

  return (
    <span
      className={`text-2xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 tabular-nums ${cfg.rowBadgeClass}`}
      title={parts.join(" · ")}
    >
      {label}
    </span>
  );
}

interface AdvisorBannerProps {
  databases: string[];
  dbInfoMap: Map<string, DbAdvisorInfo>;
  hasHistory: boolean;
  onSelectUrgent: (dbs: string[]) => void;
}

export function AdvisorBanner({
  databases,
  dbInfoMap,
  hasHistory,
  onSelectUrgent,
}: AdvisorBannerProps) {
  const t = useT();

  const { urgentDbs, counts } = useMemo(() => {
    const c: Record<UrgencyLevel, number> = { high: 0, medium: 0, low: 0, unknown: 0 };
    const urgent: string[] = [];
    for (const db of databases) {
      const level = dbInfoMap.get(db)?.level ?? "unknown";
      c[level]++;
      if (level === "high") urgent.push(db);
    }
    return { urgentDbs: urgent, counts: c };
  }, [databases, dbInfoMap]);

  if (!hasHistory || databases.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 mb-4">
        <p className="text-xs text-gray-400 dark:text-gray-600 italic">
          {t("advisor.noHistory")}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 flex-wrap">
        {(["high", "medium", "low", "unknown"] as UrgencyLevel[]).map((level) => {
          const count = counts[level];
          if (count === 0) return null;
          const cfg = URGENCY[level];
          return (
            <span
              key={level}
              className={`inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full font-medium ${cfg.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
              {count} {t(cfg.labelKey)}
            </span>
          );
        })}
      </div>

      <div className="flex-1" />

      {urgentDbs.length > 0 && (
        <button
          onClick={() => onSelectUrgent(urgentDbs)}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/20 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-lg transition-colors flex-shrink-0"
        >
          <Zap size={12} />
          {t("advisor.selectUrgent", { count: urgentDbs.length })}
        </button>
      )}
    </div>
  );
}

import { memo, useState } from "react";
import { ProgressRing } from "./ProgressRing";
import { IndexDetailDrawer } from "./IndexDetailDrawer";
import { useT } from "../../i18n";
import type { DatabaseCardData, DatabaseCardState } from "../../types";

interface Props {
  db: DatabaseCardData;
}

const BORDER: Record<DatabaseCardState, string> = {
  queued: "border-gray-300 dark:border-gray-700",
  running: "border-blue-500",
  done: "border-green-600",
  error: "border-red-600",
  skipped: "border-amber-600",
};

const BG: Record<DatabaseCardState, string> = {
  queued: "bg-white dark:bg-gray-900",
  running: "bg-blue-50 dark:bg-blue-950/40",
  done: "bg-green-50 dark:bg-green-950/30",
  error: "bg-red-50 dark:bg-red-950/30",
  skipped: "bg-amber-50 dark:bg-amber-950/20",
};

const STATE_COLOR: Record<DatabaseCardState, string> = {
  queued: "text-gray-600 dark:text-gray-500",
  running: "text-blue-500 dark:text-blue-400",
  done: "text-green-600 dark:text-green-400",
  error: "text-red-600 dark:text-red-400",
  skipped: "text-amber-600 dark:text-amber-400",
};

function fmt(n: number) {
  return n.toFixed(1);
}

function DatabaseCardComponent({ db }: Props) {
  const t = useT();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const totalIndexes = db.indexes.length;
  const processed = db.indexes_processed;
  const completedWithoutIndexes =
    totalIndexes === 0 &&
    (db.state === "done" || db.state === "error" || db.state === "skipped");
  const ringTotal = completedWithoutIndexes ? 1 : totalIndexes;
  const ringProcessed = completedWithoutIndexes ? 1 : processed;

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className={`w-full text-left border rounded-xl p-4 transition-all ${BORDER[db.state]} ${BG[db.state]} ${
          db.state === "running" ? "ring-1 ring-blue-500/30" : ""
        } hover:brightness-[0.97] dark:hover:brightness-110`}
      >
        <div className="flex items-center gap-4">
          <ProgressRing processed={ringProcessed} total={ringTotal} size={44} strokeWidth={4} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white truncate text-sm">{db.name}</span>
              <span className={`text-xs font-medium ${STATE_COLOR[db.state]}`}>
                {db.state === "running" && <span className="animate-pulse">● </span>}
                {t(`dbState.${db.state}`)}
              </span>
            </div>

            <div className="flex gap-4 mt-1.5 text-xs text-gray-700 dark:text-gray-400">
              <span className="text-blue-500 dark:text-blue-400">{db.indexes_rebuilt} {t("dbCard.rebuilt")}</span>
              <span className="text-purple-500 dark:text-purple-400">{db.indexes_reorganized} {t("dbCard.reorganized")}</span>
              <span className="text-gray-600 dark:text-gray-500">{db.indexes_skipped} {t("dbCard.skipped")}</span>
              {db.duration_secs > 0 && (
                <span className="text-gray-600 dark:text-gray-500">{fmt(db.duration_secs)}s</span>
              )}
            </div>
          </div>

          {db.errors.length > 0 && (
            <span
              className="text-xs text-red-500 dark:text-red-400 flex-shrink-0"
              title={db.errors.join("\n")}
            >
              {db.errors.length !== 1
                ? t("dbCard.errorsPlural", { count: db.errors.length })
                : t("dbCard.errors", { count: db.errors.length })}
            </span>
          )}
        </div>
      </button>

      {drawerOpen && (
        <IndexDetailDrawer db={db} onClose={() => setDrawerOpen(false)} />
      )}
    </>
  );
}

export const DatabaseCard = memo(DatabaseCardComponent, (prev, next) => prev.db === next.db);

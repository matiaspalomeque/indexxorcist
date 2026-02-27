import { useT } from "../../i18n";

interface Props {
  current: number;
  total: number;
}

export function OverallProgressBar({ current, total }: Props) {
  const t = useT();
  const clampedCurrent = total === 0 ? 0 : Math.min(Math.max(current, 0), total);
  const completedDbs = Math.floor(clampedCurrent);
  const displayPct = total === 0 ? 0 : Math.round((completedDbs / total) * 100);
  const barPct = total === 0 ? 0 : Math.round((clampedCurrent / total) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm text-gray-700 dark:text-gray-400">
        <span>{t("progress.label")}</span>
        <span>
          {t("progress.count", { current: completedDbs, total, pct: displayPct })}
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

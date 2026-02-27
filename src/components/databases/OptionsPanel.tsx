import { useT } from "../../i18n";
import type { MaintenanceOptions } from "../../types";

interface Props {
  settings: MaintenanceOptions;
  onChange: <K extends keyof MaintenanceOptions>(
    key: K,
    value: MaintenanceOptions[K]
  ) => void;
}

export function OptionsPanel({ settings, onChange }: Props) {
  const t = useT();
  const set = <K extends keyof MaintenanceOptions>(key: K, value: MaintenanceOptions[K]) =>
    onChange(key, value);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("options.title")}</h3>

      <div className="border-b border-gray-200 dark:border-gray-800 pb-4 space-y-3">
        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-500 uppercase tracking-wide">
          {t("options.sqlTimeouts")}
        </h4>
        <NumberOption
          label={t("options.connectionTimeout")}
          value={settings.connection_timeout_ms}
          onChange={(v) => set("connection_timeout_ms", v)}
          hint={t("options.noTimeout")}
        />
        <NumberOption
          label={t("options.requestTimeout")}
          value={settings.request_timeout_ms}
          onChange={(v) => set("request_timeout_ms", v)}
          hint={t("options.noTimeout")}
        />
      </div>

      <div className="border-b border-gray-200 dark:border-gray-800 pb-4 space-y-3">
        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-500 uppercase tracking-wide">
          {t("options.thresholds")}
        </h4>
        <NumberOption
          label={t("options.reorganizeThreshold")}
          value={settings.reorganize_threshold}
          onChange={(v) => set("reorganize_threshold", v)}
          min={1}
          max={99}
        />
        <NumberOption
          label={t("options.rebuildThreshold")}
          value={settings.rebuild_threshold}
          onChange={(v) => set("rebuild_threshold", v)}
          min={1}
          max={99}
        />
        {settings.rebuild_threshold < settings.reorganize_threshold && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            {t("options.thresholdHint")}
          </p>
        )}
      </div>

      <CheckboxOption
        label={t("options.rebuildOnline")}
        description={t("options.rebuildOnlineDesc")}
        checked={settings.rebuild_online}
        onChange={(v) => set("rebuild_online", v)}
      />

      <CheckboxOption
        label={t("options.freeProcCache")}
        description={t("options.freeProcCacheDesc")}
        checked={settings.free_proc_cache}
        onChange={(v) => set("free_proc_cache", v)}
      />

      <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-500 uppercase tracking-wide">
          {t("options.retry")}
        </h4>
        <NumberOption
          label={t("options.maxAttempts")}
          value={settings.retry_max_attempts}
          onChange={(v) => set("retry_max_attempts", v)}
        />
        <NumberOption
          label={t("options.baseDelay")}
          value={settings.retry_base_delay_ms}
          onChange={(v) => set("retry_base_delay_ms", v)}
        />
        <NumberOption
          label={t("options.maxDelay")}
          value={settings.retry_max_delay_ms}
          onChange={(v) => set("retry_max_delay_ms", v)}
        />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-500 uppercase tracking-wide">
          {t("options.parallel")}
        </h4>
        <CheckboxOption
          label={t("options.parallelDatabases")}
          description={t("options.parallelDatabasesDesc")}
          checked={settings.parallel_databases}
          onChange={(v) => set("parallel_databases", v)}
        />
        {settings.parallel_databases && (
          <NumberOption
            label={t("options.maxParallelDatabases")}
            value={settings.max_parallel_databases}
            onChange={(v) => set("max_parallel_databases", v)}
            min={1}
            max={16}
          />
        )}
      </div>
    </div>
  );
}

function CheckboxOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-blue-500 focus:ring-blue-500"
      />
      <div>
        <p className="text-sm text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-600 dark:text-gray-500">{description}</p>
      </div>
    </label>
  );
}

function NumberOption({
  label,
  value,
  onChange,
  hint,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <label className="text-sm text-gray-700 dark:text-gray-300">{label}</label>
        {hint && <p className="text-xs text-gray-600 dark:text-gray-500">{hint}</p>}
      </div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full sm:w-28 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-white text-right focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

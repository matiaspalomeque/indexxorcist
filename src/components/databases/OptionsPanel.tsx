import { Pencil, Settings } from "lucide-react";
import { useState } from "react";
import { useT } from "../../i18n";
import type { MaintenanceOptions } from "../../types";

interface Props {
  settings: MaintenanceOptions;
  onChange: <K extends keyof MaintenanceOptions>(
    key: K,
    value: MaintenanceOptions[K]
  ) => void;
}

type OptionsTab = "maintenance" | "connection" | "retry";

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
          min={1}
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

export function OptionsInspector({ settings, onChange }: Props) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<OptionsTab>("maintenance");
  const set = <K extends keyof MaintenanceOptions>(key: K, value: MaintenanceOptions[K]) =>
    onChange(key, value);

  const tabs: Array<{ id: OptionsTab; label: string }> = [
    { id: "maintenance", label: t("options.tabMaintenance") },
    { id: "connection", label: t("options.tabConnection") },
    { id: "retry", label: t("options.tabRetry") },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
        {t("options.runSettings")}
      </h3>

      <div
        className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700"
        role="tablist"
        aria-label={t("options.runSettings")}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`border-r border-gray-300 px-2 py-2 text-xs font-medium transition-colors last:border-r-0 dark:border-gray-700 ${
              activeTab === tab.id
                ? "bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300"
                : "bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1"
        role="tabpanel"
        aria-label={tabs.find((tab) => tab.id === activeTab)?.label}
      >
        {activeTab === "maintenance" && (
          <div className="space-y-0">
            <InspectorNumberOption
              label={t("options.reorganizeThreshold")}
              description={t("options.reorganizeThresholdDesc")}
              value={settings.reorganize_threshold}
              suffix="%"
              min={1}
              max={99}
              onChange={(value) => set("reorganize_threshold", value)}
            />
            <InspectorNumberOption
              label={t("options.rebuildThreshold")}
              description={t("options.rebuildThresholdDesc")}
              value={settings.rebuild_threshold}
              suffix="%"
              min={1}
              max={99}
              onChange={(value) => set("rebuild_threshold", value)}
            />
            {settings.rebuild_threshold < settings.reorganize_threshold && (
              <p className="border-b border-gray-200 py-3 text-xs text-amber-600 dark:border-gray-800 dark:text-amber-500">
                {t("options.thresholdHint")}
              </p>
            )}
            <InspectorSwitchOption
              label={t("options.rebuildOnlineShort")}
              description={t("options.rebuildOnlineDesc")}
              checked={settings.rebuild_online}
              onChange={(value) => set("rebuild_online", value)}
            />
            <InspectorSwitchOption
              label={t("options.freeProcCacheShort")}
              description={t("options.freeProcCacheDesc")}
              checked={settings.free_proc_cache}
              onChange={(value) => set("free_proc_cache", value)}
            />
            <InspectorSwitchOption
              label={t("options.parallel")}
              description={t("options.parallelDatabasesDesc")}
              checked={settings.parallel_databases}
              onChange={(value) => set("parallel_databases", value)}
            />
            {settings.parallel_databases && (
              <InspectorNumberOption
                label={t("options.maxParallelDatabases")}
                description={t("options.maxParallelDatabasesDesc")}
                value={settings.max_parallel_databases}
                min={1}
                max={16}
                onChange={(value) => set("max_parallel_databases", value)}
              />
            )}

            <div className="pt-5">
              <p className="text-2xs font-medium uppercase tracking-wider text-gray-500">
                {t("options.otherSettings")}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <p className="min-w-0 flex-1 text-xs leading-5 text-gray-500 dark:text-gray-500">
                  {t("options.otherSettingsSummary", {
                    connection: formatCompactDuration(settings.connection_timeout_ms, t("options.noLimit")),
                    request: formatCompactDuration(settings.request_timeout_ms, t("options.noLimit")),
                    attempts: settings.retry_max_attempts,
                  })}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("connection")}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Pencil size={12} />
                  {t("options.edit")}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "connection" && (
          <div>
            <InspectorNumberOption
              label={t("options.connectionTimeout")}
              description={t("options.noTimeout")}
              value={settings.connection_timeout_ms}
              suffix="ms"
              onChange={(value) => set("connection_timeout_ms", value)}
            />
            <InspectorNumberOption
              label={t("options.requestTimeout")}
              description={t("options.noTimeout")}
              value={settings.request_timeout_ms}
              suffix="ms"
              onChange={(value) => set("request_timeout_ms", value)}
            />
          </div>
        )}

        {activeTab === "retry" && (
          <div>
            <InspectorNumberOption
              label={t("options.maxAttempts")}
              value={settings.retry_max_attempts}
              min={1}
              onChange={(value) => set("retry_max_attempts", value)}
            />
            <InspectorNumberOption
              label={t("options.baseDelay")}
              value={settings.retry_base_delay_ms}
              suffix="ms"
              onChange={(value) => set("retry_base_delay_ms", value)}
            />
            <InspectorNumberOption
              label={t("options.maxDelay")}
              value={settings.retry_max_delay_ms}
              suffix="ms"
              onChange={(value) => set("retry_max_delay_ms", value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function OptionsSummaryLine({ settings }: { settings: MaintenanceOptions }) {
  const t = useT();
  const parts = [
    `${t("options.rebuildThreshold")} ≥${settings.rebuild_threshold}%`,
    settings.rebuild_online ? t("options.rebuildOnline") : null,
    `${settings.retry_max_attempts} ${t("options.retry").toLowerCase()}`,
    settings.parallel_databases
      ? `${settings.max_parallel_databases}x ${t("options.parallel").toLowerCase()}`
      : null,
  ].filter(Boolean);

  return (
    <summary className="flex items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none py-2">
      <Settings size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
        {parts.join(" · ")}
      </span>
    </summary>
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
  const clamp = (nextValue: number) => {
    const withMin = Math.max(nextValue, min);
    return max != null ? Math.min(withMin, max) : withMin;
  };

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
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        className="w-full sm:w-28 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-white text-right focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

function InspectorSwitchOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4 border-b border-gray-200 py-4 dark:border-gray-800">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        <span className="mt-0.5 block text-xs leading-4 text-gray-500">{description}</span>
      </span>
      <span className="relative inline-flex h-6 w-11 flex-shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:bg-gray-700 dark:peer-focus-visible:ring-offset-gray-900" />
        <span className="relative ml-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function InspectorNumberOption({
  label,
  description,
  value,
  onChange,
  suffix,
  min = 0,
  max,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  const clamp = (nextValue: number) => {
    const withMin = Math.max(nextValue, min);
    return max != null ? Math.min(withMin, max) : withMin;
  };

  return (
    <div className="flex items-center gap-4 border-b border-gray-200 py-4 dark:border-gray-800">
      <div className="min-w-0 flex-1">
        <label className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</label>
        {description && <p className="mt-0.5 text-xs leading-4 text-gray-500">{description}</p>}
      </div>
      <div className="relative flex-shrink-0">
        <input
          type="number"
          aria-label={label}
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(clamp(Number(event.target.value) || 0))}
          className={`w-24 rounded-lg border border-gray-300 bg-white py-1.5 pl-2 text-right text-sm tabular-nums text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white ${
            suffix ? "pr-8" : "pr-2"
          }`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function formatCompactDuration(valueMs: number, noLimitLabel: string): string {
  if (valueMs === 0) return noLimitLabel;
  if (valueMs >= 1000 && valueMs % 1000 === 0) return `${valueMs / 1000}s`;
  return `${valueMs}ms`;
}

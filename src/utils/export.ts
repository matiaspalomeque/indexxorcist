import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { DatabaseResult, RunRecord } from "../types";
import { dbStatusInfo, formatDuration } from "./format";

function escapeField(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function generateCsv(
  headers: string[],
  rows: (string | number)[][],
): string {
  const BOM = "\uFEFF";
  const headerLine = headers.map(escapeField).join(",");
  const dataLines = rows.map((row) => row.map(escapeField).join(","));
  return BOM + [headerLine, ...dataLines].join("\r\n");
}

async function saveCsvWithDialog(csv: string, defaultFilename: string): Promise<void> {
  const filePath = await save({
    title: "Export CSV",
    defaultPath: defaultFilename,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!filePath) return;
  await writeTextFile(filePath, csv);
}

export async function exportRunRecordsToCsv(
  records: readonly RunRecord[],
  t: (key: string) => string,
): Promise<void> {
  const headers = [
    t("history.colProfile"),
    t("history.colServer"),
    t("history.colStarted"),
    t("history.colDuration"),
    t("history.colDbs"),
    t("history.colRebuilt"),
    t("history.colReorganized"),
    t("history.colSkipped"),
  ];

  const rows = records.map((r) => [
    r.profile_name,
    r.server,
    new Date(r.started_at).toLocaleString(),
    formatDuration(r.total_duration_secs),
    r.databases_processed,
    r.total_indexes_rebuilt,
    r.total_indexes_reorganized,
    r.total_indexes_skipped,
  ]);

  const csv = generateCsv(headers, rows);
  const ts = new Date().toISOString().slice(0, 10);
  await saveCsvWithDialog(csv, `indexxorcist-history-${ts}.csv`);
}

export async function exportDatabaseResultsToCsv(
  results: readonly DatabaseResult[],
  meta: string,
  t: (key: string) => string,
): Promise<void> {
  const headers = [
    t("summary.colDatabase"),
    t("summary.colStatus"),
    t("summary.colRebuilt"),
    t("summary.colReorganized"),
    t("summary.colSkipped"),
    t("summary.colDuration"),
    t("summary.colErrors"),
  ];

  const rows = results.map((r) => {
    const { labelKey } = dbStatusInfo(r);

    return [
      r.database_name,
      t(`summary.${labelKey}`),
      r.indexes_rebuilt,
      r.indexes_reorganized,
      r.indexes_skipped,
      formatDuration(r.total_duration_secs),
      r.errors.length,
    ];
  });

  const csv = generateCsv(headers, rows);
  const ts = new Date().toISOString().slice(0, 10);
  const safeMeta = meta.replace(/[^a-zA-Z0-9_-]/g, "_");
  await saveCsvWithDialog(csv, `indexxorcist-summary-${safeMeta}-${ts}.csv`);
}

export function triggerPrint(): void {
  window.print();
}

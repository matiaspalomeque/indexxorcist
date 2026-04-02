import type { RunRecord } from "../types";

export interface HistoryFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  status: "all" | "hasErrors" | "allSuccess";
}

export const EMPTY_FILTERS: HistoryFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  status: "all",
};

export function filterRecords(
  records: readonly RunRecord[],
  filters: HistoryFilters,
): RunRecord[] {
  const { search, dateFrom, dateTo, status } = filters;
  const needle = search.trim().toLowerCase();

  return records.filter((r) => {
    if (needle) {
      const matches =
        r.profile_name.toLowerCase().includes(needle) ||
        r.server.toLowerCase().includes(needle) ||
        r.database_results.some((db) => db.database_name.toLowerCase().includes(needle));
      if (!matches) return false;
    }

    if (dateFrom) {
      // Compare in local time: "2026-03-15" → local midnight start of day
      const from = new Date(dateFrom + "T00:00:00");
      if (new Date(r.started_at) < from) return false;
    }
    if (dateTo) {
      // Include the entire local day
      const to = new Date(dateTo + "T23:59:59.999");
      if (new Date(r.started_at) > to) return false;
    }

    // Status
    if (status === "hasErrors" && r.databases_failed === 0) return false;
    if (status === "allSuccess" && r.databases_failed > 0) return false;

    return true;
  });
}

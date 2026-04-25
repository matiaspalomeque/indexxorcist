import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  GripVertical,
  LayoutGrid,
  List,
  Pin,
  Plus,
  Search,
  Square,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import * as api from "../../api/tauri";
import { useT } from "../../i18n";
import { useHistoryStore } from "../../store/historyStore";
import { useProfileSettingsStore } from "../../store/profileSettingsStore";
import { useProfileStore } from "../../store/profileStore";
import { useProfilesViewStore } from "../../store/profilesViewStore";
import {
  buildProfileTransferBundle,
  parseProfileTransferBundle,
  prepareImportedProfiles,
  sanitizeFilenameSegment,
  serializeProfileTransferBundle,
} from "../../utils/profileTransfer";
import { ENVIRONMENT_ORDER, envOrder, isSameLocalDay } from "../../utils/profileUi";
import { ProfileCard } from "./ProfileCard";
import { ProfileFormModal } from "./ProfileFormModal";
import { ProfileRow } from "./ProfileRow";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { Select } from "../shared/Select";
import { useUiStore } from "../../store/uiStore";
import type { Environment, RunRecord, ServerProfile } from "../../types";

type EnvFilter = "all" | Environment;
type SortMode = "lastUsed" | "name" | "env" | "verified" | "manual";

export function ProfileList() {
  const t = useT();
  const profiles = useProfileStore((s) => s.profiles);
  const importProfiles = useProfileStore((s) => s.importProfiles);
  const getSettings = useProfileSettingsStore((s) => s.getSettings);
  const lastTestByProfile = useProfileSettingsStore((s) => s.lastTestByProfile);
  const recordTestResult = useProfileSettingsStore((s) => s.recordTestResult);

  const records = useHistoryStore((s) => s.records);
  const loadHistory = useHistoryStore((s) => s.loadHistory);
  const clearHistory = useHistoryStore((s) => s.clearHistory);

  const pinnedIds = useProfilesViewStore((s) => s.pinnedProfileIds);
  const recentIds = useProfilesViewStore((s) => s.recentProfileIds);
  const manualOrder = useProfilesViewStore((s) => s.manualOrder);
  const viewMode = useProfilesViewStore((s) => s.viewMode);
  const groupByEnv = useProfilesViewStore((s) => s.groupByEnv);
  const setViewMode = useProfilesViewStore((s) => s.setViewMode);
  const setGroupByEnv = useProfilesViewStore((s) => s.setGroupByEnv);
  const pushRecent = useProfilesViewStore((s) => s.pushRecent);
  const setManualOrder = useProfilesViewStore((s) => s.setManualOrder);
  const remove = useProfileStore((s) => s.remove);

  const openProfileTab = useUiStore((s) => s.openProfileTab);
  const setActiveProfileId = useUiStore((s) => s.setActiveProfileId);
  const connectedProfileIds = useUiStore((s) => s.connectedProfileIds);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const [modalState, setModalState] = useState<
    | { mode: "create" }
    | { mode: "edit"; profile: ServerProfile }
    | { mode: "duplicate"; sourceProfile: ServerProfile }
    | null
  >(null);
  const [busyAction, setBusyAction] = useState<null | "import" | "exportAll">(null);
  const [busyGroup, setBusyGroup] = useState<Environment | "pinned" | null>(null);
  const [notice, setNotice] = useState<null | { tone: "success" | "error"; message: string }>(
    null
  );
  const [search, setSearch] = useState("");
  const [envFilter, setEnvFilter] = useState<EnvFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("lastUsed");
  const [collapsedEnvs, setCollapsedEnvs] = useState<Set<Environment>>(() => new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  // Mirrored ref because native dragOver fires before React has flushed the
  // setDraggingId from dragStart — without a sync read the first dragOver
  // calls would skip e.preventDefault() and the browser would refuse the drop.
  const draggingIdRef = useRef<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Manual order, normalized to current profiles. Profiles not in stored order
  // are appended in alphabetical name order so newcomers get a stable slot.
  const normalizedOrder = useMemo(() => {
    const ids = new Set(profiles.map((p) => p.id));
    const present = manualOrder.filter((id) => ids.has(id));
    const inOrder = new Set(present);
    const missing = profiles
      .filter((p) => !inOrder.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => p.id);
    return [...present, ...missing];
  }, [profiles, manualOrder]);

  const lastRunByProfile = useMemo(() => {
    const map = new Map<string, RunRecord>();
    for (const r of records) {
      const existing = map.get(r.profile_id);
      if (!existing || r.id > existing.id) map.set(r.profile_id, r);
    }
    return map;
  }, [records]);

  const sorter = useMemo(() => {
    return (a: ServerProfile, b: ServerProfile): number => {
      switch (sortMode) {
        case "name":
          return a.name.localeCompare(b.name);
        case "env":
          return envOrder(a.environment) - envOrder(b.environment) || a.name.localeCompare(b.name);
        case "verified": {
          const at = (id: string) => Date.parse(lastTestByProfile[id]?.at ?? "") || 0;
          return at(b.id) - at(a.id) || a.name.localeCompare(b.name);
        }
        case "manual": {
          const idx = (id: string) => normalizedOrder.indexOf(id);
          return idx(a.id) - idx(b.id);
        }
        case "lastUsed":
        default: {
          const ts = (id: string) => {
            const run = lastRunByProfile.get(id);
            return run ? Date.parse(run.finished_at) || 0 : 0;
          };
          return ts(b.id) - ts(a.id) || a.name.localeCompare(b.name);
        }
      }
    };
  }, [sortMode, lastTestByProfile, lastRunByProfile, normalizedOrder]);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return profiles.filter((p) => {
      if (envFilter !== "all" && (p.environment ?? "other") !== envFilter) return false;
      if (q) {
        const hay = `${p.name}\n${p.server}\n${p.username}`.toLocaleLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [profiles, search, envFilter]);

  // Pinned go to their own section; everything else is grouped or flat below.
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const pinnedProfiles = useMemo(
    () => filteredProfiles.filter((p) => pinnedSet.has(p.id)).sort(sorter),
    [filteredProfiles, pinnedSet, sorter]
  );
  const unpinnedProfiles = useMemo(
    () => filteredProfiles.filter((p) => !pinnedSet.has(p.id)).sort(sorter),
    [filteredProfiles, pinnedSet, sorter]
  );

  const groupedUnpinned = useMemo(() => {
    if (!groupByEnv) return null;
    const buckets = new Map<Environment, ServerProfile[]>();
    for (const p of unpinnedProfiles) {
      const env = p.environment ?? "other";
      const bucket = buckets.get(env) ?? [];
      bucket.push(p);
      buckets.set(env, bucket);
    }
    return ENVIRONMENT_ORDER.filter((e) => buckets.has(e)).map(
      (e) => [e, buckets.get(e)!] as const
    );
  }, [groupByEnv, unpinnedProfiles]);

  const recentProfiles = useMemo(() => {
    return recentIds
      .map((id) => profiles.find((p) => p.id === id))
      .filter((p): p is ServerProfile => Boolean(p))
      .filter((p) => !pinnedSet.has(p.id))
      .slice(0, 5);
  }, [recentIds, profiles, pinnedSet]);

  const stats = useMemo(() => {
    const total = profiles.length;
    let verifiedToday = 0;
    let prod = 0;
    for (const p of profiles) {
      if ((p.environment ?? "other") === "production") prod += 1;
      const last = lastTestByProfile[p.id];
      if (last && last.result === "success" && isSameLocalDay(last.at)) verifiedToday += 1;
    }
    return { total, verifiedToday, prod };
  }, [profiles, lastTestByProfile]);

  // Native dragover/drop on individual elements is unreliable through React's
  // synthetic event layer (especially in WKWebView). Installing a window-level
  // dragover preventDefault while a drag is active guarantees the browser
  // accepts the drop — the per-card onDragOver only tracks the highlight ring.
  useEffect(() => {
    if (!draggingId) return;
    const onWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    };
    const onWindowDrop = (e: DragEvent) => {
      // If the drop landed somewhere without a per-card handler, swallow it
      // so the browser doesn't try to navigate to text/plain payloads.
      e.preventDefault();
    };
    window.addEventListener("dragover", onWindowDragOver);
    window.addEventListener("drop", onWindowDrop);
    return () => {
      window.removeEventListener("dragover", onWindowDragOver);
      window.removeEventListener("drop", onWindowDrop);
    };
  }, [draggingId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (inField) return;
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setNotice(null);
        setModalState({ mode: "create" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeModal = () => setModalState(null);

  const buildExportFilename = (baseName: string) => {
    const ts = new Date().toISOString().slice(0, 10);
    return `indexxorcist-${sanitizeFilenameSegment(baseName)}-${ts}.json`;
  };

  const exportProfiles = async (targetProfiles: ServerProfile[], defaultFilename: string) => {
    const bundle = buildProfileTransferBundle(targetProfiles, getSettings);
    const filePath = await save({
      title: t("profiles.exportDialogTitle"),
      defaultPath: defaultFilename,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!filePath) return false;
    await writeTextFile(filePath, serializeProfileTransferBundle(bundle));
    return true;
  };

  const handleDuplicate = (profile: ServerProfile) => {
    setNotice(null);
    setModalState({ mode: "duplicate", sourceProfile: profile });
  };

  const handleExport = async (profile: ServerProfile) => {
    setNotice(null);
    try {
      await exportProfiles([profile], buildExportFilename(profile.name));
    } catch (error) {
      setNotice({ tone: "error", message: String(error) });
    }
  };

  const handleExportAll = async () => {
    setBusyAction("exportAll");
    setNotice(null);
    try {
      await exportProfiles(profiles, buildExportFilename("profiles"));
    } catch (error) {
      setNotice({ tone: "error", message: String(error) });
    } finally {
      setBusyAction(null);
    }
  };

  const handleImport = async () => {
    setBusyAction("import");
    setNotice(null);

    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      const filePath = Array.isArray(selected) ? selected[0] : selected;
      if (!filePath) return;

      const content = await readTextFile(filePath);
      const bundle = parseProfileTransferBundle(content);
      const prepared = prepareImportedProfiles(
        bundle,
        profiles.map((profile) => profile.name)
      );

      await importProfiles(prepared);
      setNotice({
        tone: "success",
        message: t("profiles.importSuccess", { count: prepared.length }),
      });
    } catch (error) {
      setNotice({ tone: "error", message: String(error) });
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestGroup = async (
    groupKey: Environment | "pinned",
    members: ServerProfile[]
  ) => {
    if (members.length === 0) return;
    setBusyGroup(groupKey);
    await Promise.allSettled(
      members.map(async (p) => {
        try {
          await api.testConnection(p.id);
          recordTestResult(p.id, { result: "success", at: new Date().toISOString() });
        } catch (e) {
          recordTestResult(p.id, {
            result: "error",
            at: new Date().toISOString(),
            error: String(e),
          });
        }
      })
    );
    setBusyGroup(null);
  };

  const toggleEnvCollapsed = (env: Environment) => {
    setCollapsedEnvs((prev) => {
      const next = new Set(prev);
      if (next.has(env)) next.delete(env);
      else next.add(env);
      return next;
    });
  };

  const handleConnectRecent = (profile: ServerProfile) => {
    pushRecent(profile.id);
    if (connectedProfileIds.includes(profile.id)) {
      setActiveProfileId(profile.id);
    } else {
      openProfileTab(profile.id);
    }
  };

  const dragEnabled = sortMode === "manual" && !bulkMode;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!dragEnabled) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    draggingIdRef.current = id;
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string, targetEnv?: Environment) => {
    if (!dragEnabled) return;
    const draggedId = draggingIdRef.current;
    if (!draggedId || draggedId === targetId) return;
    if (groupByEnv && targetEnv) {
      const dragged = profiles.find((p) => p.id === draggedId);
      if (dragged && (dragged.environment ?? "other") !== targetEnv) return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTargetId !== targetId) setDropTargetId(targetId);
  };

  const handleDragLeave = (targetId: string) => {
    if (dropTargetId === targetId) setDropTargetId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    if (!dragEnabled) return;
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain") || draggingIdRef.current;
    draggingIdRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
    if (!draggedId || draggedId === targetId) return;
    const without = normalizedOrder.filter((id) => id !== draggedId);
    const targetIdx = without.indexOf(targetId);
    if (targetIdx === -1) return;
    const next = [...without.slice(0, targetIdx), draggedId, ...without.slice(targetIdx)];
    setManualOrder(next);
  };

  const handleDragEnd = () => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
  };

  const handleSelectAllInView = () => {
    setSelectedIds(new Set(filteredProfiles.map((p) => p.id)));
  };

  const handleBulkExport = async () => {
    if (selectedIds.size === 0) return;
    const targets = profiles.filter((p) => selectedIds.has(p.id));
    setNotice(null);
    try {
      const exported = await exportProfiles(
        targets,
        buildExportFilename(`profiles-${targets.length}`)
      );
      if (exported) exitBulkMode();
    } catch (error) {
      setNotice({ tone: "error", message: String(error) });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setNotice(null);
    setBulkDeleteOpen(false);
    try {
      for (const id of ids) {
        let removeError: unknown;
        try {
          await remove(id);
        } catch (error) {
          removeError = error;
        }
        if (!useProfileStore.getState().profiles.some((p) => p.id === id)) {
          await clearHistory(id);
        }
        if (removeError) throw removeError;
      }
      await loadHistory();
      exitBulkMode();
    } catch (error) {
      setNotice({ tone: "error", message: String(error) });
    }
  };

  const renderProfileItem = (p: ServerProfile) => {
    const common = {
      profile: p,
      lastRun: lastRunByProfile.get(p.id),
      onEdit: () => {
        setNotice(null);
        setModalState({ mode: "edit", profile: p });
      },
      onDuplicate: () => handleDuplicate(p),
      onExport: () => void handleExport(p),
    };
    const inner =
      viewMode === "list" ? <ProfileRow {...common} /> : <ProfileCard {...common} />;

    const isDragging = draggingId === p.id;
    const isDropTarget = dropTargetId === p.id;
    const isSelected = selectedIds.has(p.id);
    const wrapperEnv = (p.environment ?? "other") as Environment;
    const needsGutter = dragEnabled || bulkMode;

    const wrapperCls = [
      "relative flex items-stretch transition-opacity",
      viewMode === "list" ? "rounded-lg" : "rounded-xl",
      needsGutter ? "gap-1.5" : "",
      isDragging ? "opacity-40" : "",
      isDropTarget ? "ring-2 ring-blue-400" : "",
      bulkMode ? "cursor-pointer" : "",
      bulkMode && isSelected ? "ring-2 ring-blue-500" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        key={p.id}
        className={wrapperCls}
        draggable={dragEnabled}
        onDragStart={(e) => handleDragStart(e, p.id)}
        onDragOver={(e) => handleDragOver(e, p.id, wrapperEnv)}
        onDragLeave={() => handleDragLeave(p.id)}
        onDrop={(e) => handleDrop(e, p.id)}
        onDragEnd={handleDragEnd}
        // In bulk mode, intercept clicks at capture phase so the inner card
        // buttons (Connect/Test/Edit/etc.) don't fire — selection toggle wins.
        onClickCapture={
          bulkMode
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSelected(p.id);
              }
            : undefined
        }
      >
        {needsGutter && (
          <div
            className={`flex-shrink-0 w-6 flex ${
              viewMode === "list" ? "items-center" : "items-start pt-4"
            } justify-center`}
          >
            {bulkMode ? (
              isSelected ? (
                <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
              ) : (
                <Square size={18} className="text-gray-400" />
              )
            ) : (
              <GripVertical
                size={16}
                className="text-gray-400 dark:text-gray-600 cursor-grab active:cursor-grabbing"
                aria-hidden
              />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">{inner}</div>
      </div>
    );
  };

  const itemContainerCls =
    viewMode === "list"
      ? "flex flex-col gap-2"
      : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3";

  const envFilterOptions: { value: EnvFilter; label: string }[] = [
    { value: "all", label: t("profiles.filterAll") },
    { value: "production", label: t("env.production") },
    { value: "staging", label: t("env.staging") },
    { value: "uat", label: t("env.uat") },
    { value: "development", label: t("env.development") },
    { value: "other", label: t("env.other") },
  ];

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: "lastUsed", label: t("profiles.sortLastUsed") },
    { value: "name", label: t("profiles.sortName") },
    { value: "env", label: t("profiles.sortEnv") },
    { value: "verified", label: t("profiles.sortVerified") },
    { value: "manual", label: t("profiles.sortManual") },
  ];

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1700px]">
        <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {t("profiles.title")}
            </h2>
            <p className="text-sm text-gray-700 dark:text-gray-400 mt-0.5">
              {t("profiles.statTotal", { count: stats.total })}
              {" · "}
              {t("profiles.statVerified", { count: stats.verifiedToday })}
              {" · "}
              {t("profiles.statProd", { count: stats.prod })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleImport}
              disabled={busyAction !== null}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Upload size={16} />
              {busyAction === "import" ? t("profiles.importing") : t("profiles.import")}
            </button>
            <button
              onClick={handleExportAll}
              disabled={busyAction !== null || profiles.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              {busyAction === "exportAll"
                ? t("profiles.exportingAll")
                : t("profiles.exportAll")}
            </button>
            <button
              onClick={() => {
                setNotice(null);
                setModalState({ mode: "create" });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} />
              {t("profiles.newProfile")}
            </button>
          </div>
        </div>

        {profiles.length > 0 && (
          <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="relative flex-1 max-w-md min-w-[220px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                aria-hidden
              />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("profiles.searchHint")}
                aria-label={t("profiles.search")}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select<EnvFilter>
                value={envFilter}
                onChange={setEnvFilter}
                options={envFilterOptions}
                aria-label={t("profiles.filterEnv")}
              />
              <Select<SortMode>
                value={sortMode}
                onChange={setSortMode}
                options={sortOptions}
                aria-label={t("profiles.sort")}
              />
              <button
                onClick={() => setGroupByEnv(!groupByEnv)}
                className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                  groupByEnv
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                aria-pressed={groupByEnv}
              >
                {t("profiles.groupByEnv")}
              </button>
              <button
                onClick={() => {
                  if (bulkMode) exitBulkMode();
                  else setBulkMode(true);
                }}
                className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                  bulkMode
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                aria-pressed={bulkMode}
              >
                {t("profiles.select")}
              </button>
              <div className="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  aria-pressed={viewMode === "grid"}
                  aria-label={t("profiles.viewGrid")}
                  title={t("profiles.viewGrid")}
                  className={`p-2 transition-colors ${
                    viewMode === "grid"
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-white"
                  }`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                  aria-label={t("profiles.viewList")}
                  title={t("profiles.viewList")}
                  className={`p-2 transition-colors ${
                    viewMode === "list"
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-white"
                  }`}
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {recentProfiles.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-1.5">
              {t("profiles.recent")}
            </p>
            <div className="flex flex-wrap gap-2">
              {recentProfiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleConnectRecent(p)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  title={`${p.server}:${p.port}`}
                >
                  <span className="font-medium">{p.name}</span>
                  {p.environment && p.environment !== "other" && (
                    <span className="text-gray-500 dark:text-gray-500">
                      · {t(`env.short.${p.environment}`)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {notice && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              notice.tone === "success"
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
            }`}
          >
            {notice.message}
          </div>
        )}

        {bulkMode && (
          <div className="mb-4 flex flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {t("profiles.bulkSelected", { count: selectedIds.size })}
            </span>
            <button
              onClick={handleSelectAllInView}
              className="text-xs px-2 py-1 text-blue-700 dark:text-blue-300 hover:underline"
            >
              {t("profiles.bulkSelectAllInView")}
            </button>
            <span className="flex-1" />
            <button
              onClick={() => void handleBulkExport()}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Download size={12} />
              {t("profiles.bulkExport", { count: selectedIds.size })}
            </button>
            <button
              onClick={() => setBulkDeleteOpen(true)}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors disabled:opacity-50"
            >
              <Trash2 size={12} />
              {t("profiles.bulkDelete", { count: selectedIds.size })}
            </button>
            <button
              onClick={exitBulkMode}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <X size={12} />
              {t("profiles.bulkCancel")}
            </button>
          </div>
        )}

        {sortMode === "manual" && !bulkMode && profiles.length > 1 && (
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-500">
            {t("profiles.manualHint")}
          </p>
        )}

        {bulkDeleteOpen && (
          <ConfirmDialog
            title={t("profiles.bulkDeleteTitle")}
            message={t("profiles.bulkDeleteMessage", { count: selectedIds.size })}
            confirmLabel={t("profiles.bulkDeleteConfirm")}
            cancelLabel={t("confirm.cancel")}
            variant="danger"
            onConfirm={() => void handleBulkDelete()}
            onCancel={() => setBulkDeleteOpen(false)}
          />
        )}

        {profiles.length === 0 ? (
          <EmptyState
            t={t}
            onCreate={() => {
              setNotice(null);
              setModalState({ mode: "create" });
            }}
            onImport={handleImport}
            importBusy={busyAction === "import"}
          />
        ) : filteredProfiles.length === 0 ? (
          <div className="text-center py-16 text-gray-600 dark:text-gray-500">
            <p className="text-sm">{t("profiles.noMatches")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pinnedProfiles.length > 0 && (
              <SectionHeader
                title={t("profiles.pinned")}
                count={pinnedProfiles.length}
                icon={<Pin size={13} className="text-blue-500" />}
                onTestAll={() => handleTestGroup("pinned", pinnedProfiles)}
                testingAll={busyGroup === "pinned"}
                t={t}
              >
                <div className={itemContainerCls}>
                  {pinnedProfiles.map(renderProfileItem)}
                </div>
              </SectionHeader>
            )}

            {groupedUnpinned ? (
              groupedUnpinned.map(([env, members]) => {
                const collapsed = collapsedEnvs.has(env);
                return (
                  <SectionHeader
                    key={env}
                    title={t(`env.${env}`)}
                    count={members.length}
                    collapsible
                    collapsed={collapsed}
                    onToggleCollapsed={() => toggleEnvCollapsed(env)}
                    onTestAll={() => handleTestGroup(env, members)}
                    testingAll={busyGroup === env}
                    t={t}
                  >
                    {!collapsed && (
                      <div className={itemContainerCls}>{members.map(renderProfileItem)}</div>
                    )}
                  </SectionHeader>
                );
              })
            ) : (
              unpinnedProfiles.length > 0 && (
                <div className={itemContainerCls}>
                  {unpinnedProfiles.map(renderProfileItem)}
                </div>
              )
            )}
          </div>
        )}

        {modalState &&
          (modalState.mode === "duplicate" ? (
            <ProfileFormModal
              mode="duplicate"
              sourceProfile={modalState.sourceProfile}
              existingNames={profiles.map((p) => p.name)}
              onClose={closeModal}
            />
          ) : (
            <ProfileFormModal {...modalState} onClose={closeModal} />
          ))}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  icon,
  collapsible,
  collapsed,
  onToggleCollapsed,
  onTestAll,
  testingAll,
  t,
  children,
}: {
  title: string;
  count: number;
  icon?: React.ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onTestAll?: () => void;
  testingAll?: boolean;
  t: ReturnType<typeof useT>;
  children: React.ReactNode;
}) {
  const heading = (
    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
      {collapsible &&
        (collapsed ? (
          <ChevronRight size={14} className="text-gray-500" />
        ) : (
          <ChevronDown size={14} className="text-gray-500" />
        ))}
      {icon}
      <span>{title}</span>
      <span className="text-xs text-gray-500 dark:text-gray-500">({count})</span>
    </div>
  );

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-2">
        {collapsible ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex items-center gap-2 -ml-1 px-1 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {heading}
          </button>
        ) : (
          heading
        )}
        {onTestAll && (
          <button
            onClick={onTestAll}
            disabled={testingAll}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white border border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded-md transition-colors disabled:opacity-50"
          >
            <Zap size={12} className={testingAll ? "animate-pulse text-yellow-500" : ""} />
            {testingAll ? t("profiles.testingAll") : t("profiles.testAll")}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  t,
  onCreate,
  onImport,
  importBusy,
}: {
  t: ReturnType<typeof useT>;
  onCreate: () => void;
  onImport: () => void;
  importBusy: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 flex items-center justify-center mb-3">
        <Plus size={20} className="text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
        {t("profiles.emptyTitle")}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-sm">
        {t("profiles.emptyHint")}
      </p>
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          {t("profiles.newProfile")}
        </button>
        <button
          onClick={onImport}
          disabled={importBusy}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          <Upload size={16} />
          {importBusy ? t("profiles.importing") : t("profiles.import")}
        </button>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-4">
        {t("profiles.shortcutHint")}
      </p>
    </div>
  );
}

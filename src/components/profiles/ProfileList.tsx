import { Download, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useT } from "../../i18n";
import { useProfileSettingsStore } from "../../store/profileSettingsStore";
import { useProfileStore } from "../../store/profileStore";
import {
  buildProfileTransferBundle,
  parseProfileTransferBundle,
  prepareImportedProfiles,
  sanitizeFilenameSegment,
  serializeProfileTransferBundle,
} from "../../utils/profileTransfer";
import { ProfileCard } from "./ProfileCard";
import { ProfileFormModal } from "./ProfileFormModal";
import type { ServerProfile } from "../../types";

export function ProfileList() {
  const t = useT();
  const profiles = useProfileStore((s) => s.profiles);
  const importProfiles = useProfileStore((s) => s.importProfiles);
  const getSettings = useProfileSettingsStore((s) => s.getSettings);
  const [modalState, setModalState] = useState<
    | { mode: "create" }
    | { mode: "edit"; profile: ServerProfile }
    | { mode: "duplicate"; sourceProfile: ServerProfile }
    | null
  >(null);
  const [busyAction, setBusyAction] = useState<null | "import" | "exportAll">(null);
  const [notice, setNotice] = useState<null | { tone: "success" | "error"; message: string }>(
    null
  );

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
      await exportProfiles(
        profiles,
        buildExportFilename("profiles")
      );
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

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1700px]">
        <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("profiles.title")}</h2>
            <p className="text-sm text-gray-700 dark:text-gray-400 mt-0.5">
              {t("profiles.subtitle")}
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

        {profiles.length === 0 ? (
          <div className="text-center py-16 text-gray-600 dark:text-gray-500">
            <p className="text-sm">{t("profiles.empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {profiles.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                onEdit={() => {
                  setNotice(null);
                  setModalState({ mode: "edit", profile: p });
                }}
                onDuplicate={() => handleDuplicate(p)}
                onExport={() => void handleExport(p)}
              />
            ))}
          </div>
        )}

        {modalState && (
          modalState.mode === "duplicate" ? (
            <ProfileFormModal
              mode="duplicate"
              sourceProfile={modalState.sourceProfile}
              existingNames={profiles.map((p) => p.name)}
              onClose={closeModal}
            />
          ) : (
            <ProfileFormModal {...modalState} onClose={closeModal} />
          )
        )}
      </div>
    </div>
  );
}

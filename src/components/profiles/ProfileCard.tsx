import { CheckCircle, Edit2, Trash2, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import * as api from "../../api/tauri";
import { useT } from "../../i18n";
import { useProfileStore } from "../../store/profileStore";
import { useUiStore } from "../../store/uiStore";
import type { ServerProfile } from "../../types";

type TestStatus = "idle" | "testing" | "success" | "error";

interface Props {
  profile: ServerProfile;
  onEdit: () => void;
}

export function ProfileCard({ profile, onEdit }: Props) {
  const t = useT();
  const { remove } = useProfileStore();
  const openProfileTab = useUiStore((s) => s.openProfileTab);
  const connectedProfileIds = useUiStore((s) => s.connectedProfileIds);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testError, setTestError] = useState("");
  const alreadyOpened = connectedProfileIds.includes(profile.id);

  const handleTest = async () => {
    setTestStatus("testing");
    setTestError("");
    try {
      await api.testConnection(profile.id);
      setTestStatus("success");
    } catch (e) {
      setTestError(String(e));
      setTestStatus("error");
    }
  };

  const handleConnect = () => {
    openProfileTab(profile.id);
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{profile.name}</h3>
        </div>

        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          {testStatus === "success" && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle size={12} /> {t("profileCard.connected")}
            </span>
          )}
          {testStatus === "error" && (
            <span
              className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400"
              title={testError}
            >
              <XCircle size={12} /> {t("profileCard.failed")}
            </span>
          )}

          <button
            onClick={handleTest}
            disabled={testStatus === "testing"}
            className="p-1.5 text-gray-400 hover:text-yellow-500 transition-colors disabled:opacity-50"
            title={t("profileCard.testConnection")}
          >
            <Zap size={15} className={testStatus === "testing" ? "animate-pulse" : ""} />
          </button>

          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
            title={t("profileCard.edit")}
          >
            <Edit2 size={15} />
          </button>

          <button
            onClick={() => remove(profile.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
            title={t("profileCard.delete")}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-400 mt-0.5">
        {profile.server}:{profile.port}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-500">
        {profile.username}
      </p>

      <div className="mt-auto pt-3 flex items-center justify-end gap-2">
        {profile.encrypt && (
          <span className="text-xs text-gray-600 dark:text-gray-500">{t("profileCard.tls")}</span>
        )}
        <button
          onClick={handleConnect}
          disabled={alreadyOpened}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-400 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {alreadyOpened ? t("profileCard.alreadyOpened") : t("profileCard.connect")}
        </button>
      </div>
    </div>
  );
}

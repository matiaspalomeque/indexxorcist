import { AlertTriangle, CheckCircle2, Pin, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import { useT } from "../../i18n";
import { useProfileStore } from "../../store/profileStore";
import type { RunRecord, ServerProfile } from "../../types";
import { envVisuals, relativeTime } from "../../utils/profileUi";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { ProfileActionMenu } from "./ProfileActionMenu";
import { useProfileActions } from "./useProfileActions";

interface Props {
  profile: ServerProfile;
  lastRun?: RunRecord;
  onEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
}

export function ProfileRow({ profile, lastRun, onEdit, onDuplicate, onExport }: Props) {
  const t = useT();
  const { remove } = useProfileStore();
  const {
    localStatus,
    lastTest,
    alreadyOpened,
    isPinned,
    handleTest,
    handleConnect,
    togglePin,
  } = useProfileActions(profile);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const visuals = envVisuals(profile.environment);
  const envShort = t(`env.short.${profile.environment ?? "other"}`);

  const verifiedLabel = (() => {
    if (localStatus === "testing") return t("profileCard.testing");
    if (!lastTest) return t("profileCard.statusUntested");
    const rt = relativeTime(lastTest.at);
    const when = t(rt.key, rt.values);
    if (lastTest.result === "success") {
      return rt.key === "profileCard.timeJustNow"
        ? t("profileCard.statusVerifiedJustNow")
        : t("profileCard.statusVerifiedAt", { when });
    }
    return t("profileCard.statusFailedAt", { when });
  })();

  const lastRunLabel = (() => {
    if (!lastRun) return t("profileCard.lastRunNever");
    const rt = relativeTime(lastRun.finished_at);
    return t("profileCard.lastRun", { when: t(rt.key, rt.values) });
  })();

  return (
    <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg flex">
      <div className={`w-1 flex-shrink-0 rounded-l-lg ${visuals.rail}`} aria-hidden />

      <div className="flex-1 min-w-0 px-3 py-2 flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isPinned && (
            <Pin
              size={11}
              className="text-blue-500 fill-blue-500 flex-shrink-0"
              aria-label={t("profileCard.pinned")}
            />
          )}
          <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {profile.name}
          </span>
          {profile.environment && profile.environment !== "other" && (
            <span
              className={`text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${visuals.chipBg} ${visuals.chipText} ${visuals.chipBorder}`}
            >
              {envShort}
            </span>
          )}
          {profile.trust_server_certificate && (
            <AlertTriangle
              size={12}
              className="text-amber-500 flex-shrink-0"
              aria-label={t("profileCard.trustCertWarning")}
            />
          )}
        </div>

        <span className="hidden md:inline text-xs text-gray-600 dark:text-gray-400 truncate flex-1 min-w-0">
          {profile.server}:{profile.port}
        </span>

        <span className="hidden lg:inline text-xs text-gray-500 dark:text-gray-500 truncate min-w-0 flex-1">
          {profile.username}
        </span>

        <span className="hidden xl:inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
          {renderStatusIcon(localStatus, lastTest?.result)}
          <span className="truncate max-w-[160px]">{verifiedLabel}</span>
        </span>

        <span className="hidden 2xl:inline text-xs text-gray-500 dark:text-gray-500 flex-shrink-0 truncate max-w-[180px]">
          {lastRunLabel}
        </span>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleTest}
            disabled={localStatus === "testing"}
            className="p-1.5 text-gray-500 hover:text-yellow-500 transition-colors disabled:opacity-50"
            title={t("profileCard.testConnection")}
            aria-label={t("profileCard.testConnection")}
          >
            <Zap size={14} className={localStatus === "testing" ? "animate-pulse" : ""} />
          </button>
          <button
            onClick={handleConnect}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors whitespace-nowrap"
          >
            {alreadyOpened ? t("profileCard.switchToTab") : t("profileCard.connectShort")}
          </button>
          <ProfileActionMenu
            isPinned={isPinned}
            onTogglePin={togglePin}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onExport={onExport}
            onDelete={() => setShowDeleteConfirm(true)}
          />
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title={t("confirm.deleteProfileTitle")}
          message={t("confirm.deleteProfileMessage", { name: profile.name })}
          confirmLabel={t("confirm.deleteProfileConfirm")}
          cancelLabel={t("confirm.cancel")}
          variant="danger"
          onConfirm={() => {
            remove(profile.id);
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

function renderStatusIcon(local: "idle" | "testing", result: "success" | "error" | undefined) {
  if (local === "testing") return <Zap size={11} className="text-yellow-500 animate-pulse" />;
  if (result === "success") return <CheckCircle2 size={11} className="text-green-500" />;
  if (result === "error") return <XCircle size={11} className="text-red-500" />;
  return <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />;
}

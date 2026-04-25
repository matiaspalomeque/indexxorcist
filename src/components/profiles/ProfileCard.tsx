import { AlertTriangle, CheckCircle2, Pin, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import { useT } from "../../i18n";
import { useProfileStore } from "../../store/profileStore";
import type { RunRecord, ServerProfile } from "../../types";
import { envVisuals, relativeTime } from "../../utils/profileUi";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { ProfileActionMenu } from "./ProfileActionMenu";
import { useProfileActions, type LocalTestStatus } from "./useProfileActions";
import type { ProfileTestStatus } from "../../store/profileSettingsStore";

interface Props {
  profile: ServerProfile;
  lastRun?: RunRecord;
  onEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
}

export function ProfileCard({ profile, lastRun, onEdit, onDuplicate, onExport }: Props) {
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

  const statusDot = renderStatusDot(t, localStatus, lastTest);

  return (
    <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl h-full flex">
      <div className={`w-1 flex-shrink-0 rounded-l-xl ${visuals.rail}`} aria-hidden />

      <div className="flex-1 min-w-0 p-4 flex flex-col">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isPinned && (
                <Pin
                  size={12}
                  className="text-blue-500 fill-blue-500"
                  aria-label={t("profileCard.pinned")}
                />
              )}
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {profile.name}
              </h3>
              <EnvChip env={profile.environment} short={envShort} t={t} />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-400 mt-0.5 truncate">
              {profile.server}:{profile.port}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 truncate">
              {profile.username} · {t("profileCard.authSql")}
              {profile.encrypt && ` · ${t("profileCard.tls")}`}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleTest}
              disabled={localStatus === "testing"}
              className="p-1.5 text-gray-500 hover:text-yellow-500 transition-colors disabled:opacity-50"
              title={t("profileCard.testConnection")}
              aria-label={t("profileCard.testConnection")}
            >
              <Zap size={15} className={localStatus === "testing" ? "animate-pulse" : ""} />
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

        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 min-w-0 truncate">
              {statusDot}
            </span>
            <span className="text-gray-500 dark:text-gray-500 truncate">
              {renderLastRun(lastRun, t)}
            </span>
          </div>

          {profile.trust_server_certificate && (
            <div
              className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"
              title={t("profileCard.trustCertWarningTooltip")}
            >
              <AlertTriangle size={12} />
              {t("profileCard.trustCertWarning")}
            </div>
          )}
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

        <div className="mt-auto pt-3 flex items-center justify-end gap-2">
          <button
            onClick={handleConnect}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {alreadyOpened ? t("profileCard.switchToTab") : t("profileCard.connect")}
          </button>
        </div>
      </div>
    </div>
  );
}

function renderStatusDot(
  t: ReturnType<typeof useT>,
  local: LocalTestStatus,
  lastTest: ProfileTestStatus | undefined
) {
  if (local === "testing") {
    return (
      <>
        <Zap size={12} className="text-yellow-500 animate-pulse" />
        {t("profileCard.testing")}
      </>
    );
  }
  if (!lastTest) {
    return (
      <>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
        {t("profileCard.statusUntested")}
      </>
    );
  }
  const rt = relativeTime(lastTest.at);
  const when = t(rt.key, rt.values);
  if (lastTest.result === "success") {
    return (
      <>
        <CheckCircle2 size={12} className="text-green-500" />
        {rt.key === "profileCard.timeJustNow"
          ? t("profileCard.statusVerifiedJustNow")
          : t("profileCard.statusVerifiedAt", { when })}
      </>
    );
  }
  return (
    <span title={lastTest.error} className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
      <XCircle size={12} />
      {t("profileCard.statusFailedAt", { when })}
    </span>
  );
}

function renderLastRun(lastRun: RunRecord | undefined, t: ReturnType<typeof useT>) {
  if (!lastRun) return t("profileCard.lastRunNever");
  const rt = relativeTime(lastRun.finished_at);
  const when = t(rt.key, rt.values);
  const dbs = t("profileCard.lastRunDbs", { count: lastRun.databases_processed });
  const failed =
    lastRun.databases_failed > 0
      ? ` · ${t("profileCard.lastRunFailed", { count: lastRun.databases_failed })}`
      : "";
  return `${t("profileCard.lastRun", { when })} · ${dbs}${failed}`;
}

function EnvChip({
  env,
  short,
  t,
}: {
  env: ServerProfile["environment"] | undefined;
  short: string;
  t: ReturnType<typeof useT>;
}) {
  if (!env || env === "other") return null;
  const v = envVisuals(env);
  return (
    <span
      className={`text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded border ${v.chipBg} ${v.chipText} ${v.chipBorder}`}
      title={t(`env.${env}`)}
    >
      {short}
    </span>
  );
}

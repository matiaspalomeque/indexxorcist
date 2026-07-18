import { AlertTriangle, CheckCircle2, Eye, EyeOff, X, XCircle, Zap } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as api from "../../api/tauri";
import { useT } from "../../i18n";
import { useDialogA11y } from "../../hooks/useDialogA11y";
import { useProfileStore } from "../../store/profileStore";
import { createDuplicateProfileName } from "../../utils/profileTransfer";
import { buildConnectionString, ENVIRONMENT_ORDER } from "../../utils/profileUi";
import { Select } from "../shared/Select";
import type { Environment, ServerProfile } from "../../types";

type Props = { onClose: () => void } & (
  | { mode: "create" }
  | { mode: "edit"; profile: ServerProfile }
  | { mode: "duplicate"; sourceProfile: ServerProfile; existingNames: string[] }
);

const DEFAULTS: Omit<ServerProfile, "id" | "name"> = {
  server: "",
  port: 1433,
  auth_type: "sqlServer",
  username: "",
  password: "",
  encrypt: true,
  trust_server_certificate: true,
  environment: "other",
};

type TestState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function ProfileFormModal(props: Props) {
  const { onClose } = props;
  const t = useT();
  const { save, duplicate } = useProfileStore();
  const isNew = props.mode === "create";
  const isDuplicate = props.mode === "duplicate";
  const dialogRef = useRef<HTMLDivElement>(null);
  const fieldPrefix = useId();
  useDialogA11y(dialogRef, onClose);

  const [form, setForm] = useState<ServerProfile>(() => {
    if (props.mode === "edit") {
      return { ...props.profile, environment: props.profile.environment ?? "other" };
    }
    if (props.mode === "duplicate") {
      return {
        ...props.sourceProfile,
        id: crypto.randomUUID(),
        name: createDuplicateProfileName(props.sourceProfile.name, props.existingNames),
        password: "",
        environment: props.sourceProfile.environment ?? "other",
      };
    }
    return { id: crypto.randomUUID(), name: "", ...DEFAULTS };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });

  const set = (key: keyof ServerProfile, value: unknown) => {
    setError("");
    if (
      key === "server" ||
      key === "port" ||
      key === "username" ||
      key === "password" ||
      key === "encrypt" ||
      key === "trust_server_certificate"
    ) {
      setTestState({ kind: "idle" });
    }
    setForm((f) => ({ ...f, [key]: value }));
  };

  const connStringPreview = useMemo(
    () =>
      buildConnectionString({
        server: form.server || "<server>",
        port: form.port,
        username: form.username || "<user>",
        encrypt: form.encrypt,
        trust_server_certificate: form.trust_server_certificate,
      }),
    [form.server, form.port, form.username, form.encrypt, form.trust_server_certificate]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const profileToSave = {
      ...form,
      name: form.name.trim(),
      server: form.server.trim(),
      username: form.username.trim(),
    };
    if (!profileToSave.name || !profileToSave.server || !profileToSave.username) {
      setError(t("profileForm.validationError"));
      return;
    }
    if (!Number.isInteger(profileToSave.port) || profileToSave.port < 1 || profileToSave.port > 65535) {
      setError(t("profileForm.portInvalid"));
      return;
    }
    if (isNew && !profileToSave.password) {
      setError(t("profileForm.passwordRequired"));
      return;
    }
    setSaving(true);
    try {
      if (props.mode === "duplicate") {
        await duplicate(props.sourceProfile.id, profileToSave);
      } else {
        await save(profileToSave);
      }
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const profileToTest = {
      ...form,
      name: form.name.trim(),
      server: form.server.trim(),
      username: form.username.trim(),
    };
    if (!profileToTest.server || !profileToTest.username) {
      setTestState({ kind: "error", message: t("profileForm.testInFormRequired") });
      return;
    }
    if (!Number.isInteger(profileToTest.port) || profileToTest.port < 1 || profileToTest.port > 65535) {
      setTestState({ kind: "error", message: t("profileForm.portInvalid") });
      return;
    }

    const fallbackPasswordProfileId =
      profileToTest.password === ""
        ? props.mode === "edit"
          ? props.profile.id
          : props.mode === "duplicate"
          ? props.sourceProfile.id
          : undefined
        : undefined;
    if (!profileToTest.password && !fallbackPasswordProfileId) {
      setTestState({ kind: "error", message: t("profileForm.passwordRequired") });
      return;
    }

    setTestState({ kind: "running" });
    try {
      await api.testProfileConnection(profileToTest, fallbackPasswordProfileId);
      setTestState({ kind: "success" });
    } catch (err) {
      setTestState({ kind: "error", message: String(err) });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-form-title"
        tabIndex={-1}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-xl mx-4 shadow-2xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 id="profile-form-title" className="font-semibold text-gray-900 dark:text-white">
            {isNew
              ? t("profileForm.titleNew")
              : isDuplicate
              ? t("profileForm.titleDuplicate")
              : t("profileForm.titleEdit")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white"
            aria-label={t("profileForm.cancel")}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label={t("profileForm.nameLabel")} htmlFor={`${fieldPrefix}-name`}>
                <input
                  id={`${fieldPrefix}-name`}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={t("profileForm.namePlaceholder")}
                  required
                  className={INPUT_CLS}
                />
              </Field>
            </div>
            <Field label={t("profileForm.environmentLabel")}>
              <Select<Environment>
                value={form.environment ?? "other"}
                onChange={(v) => set("environment", v)}
                options={ENVIRONMENT_ORDER.map((e) => ({ value: e, label: t(`env.${e}`) }))}
                aria-label={t("profileForm.environmentLabel")}
              />
            </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label={t("profileForm.serverLabel")} htmlFor={`${fieldPrefix}-server`}>
                <input
                  id={`${fieldPrefix}-server`}
                  value={form.server}
                  onChange={(e) => set("server", e.target.value)}
                  placeholder={t("profileForm.serverPlaceholder")}
                  required
                  className={INPUT_CLS}
                />
              </Field>
            </div>
            <Field label={t("profileForm.portLabel")} htmlFor={`${fieldPrefix}-port`}>
              <input
                id={`${fieldPrefix}-port`}
                type="number"
                value={form.port}
                min={1}
                max={65535}
                onChange={(e) => set("port", Number(e.target.value))}
                className={INPUT_CLS}
              />
            </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("profileForm.usernameLabel")} htmlFor={`${fieldPrefix}-username`}>
              <input
                id={`${fieldPrefix}-username`}
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                required
                className={INPUT_CLS}
              />
            </Field>
            <Field label={t("profileForm.passwordLabel")} htmlFor={`${fieldPrefix}-password`}>
              <div className="relative">
                <input
                  id={`${fieldPrefix}-password`}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  required={isNew}
                  className={`${INPUT_CLS} pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                  aria-label={showPassword ? t("profileForm.passwordHide") : t("profileForm.passwordShow")}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {!isNew && !isDuplicate && (
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-500">
                  {t("profileForm.passwordHelpEdit")}
                </p>
              )}
              {isDuplicate && (
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-500">
                  {t("profileForm.passwordHelpDuplicate")}
                </p>
              )}
            </Field>
            </div>

            <div className="pt-1">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-400 mb-2">
              {t("profileForm.security")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <CheckboxField
                label={t("profileForm.encryptLabel")}
                checked={form.encrypt}
                onChange={(v) => set("encrypt", v)}
              />
              <CheckboxField
                label={t("profileForm.trustCertLabel")}
                checked={form.trust_server_certificate}
                onChange={(v) => set("trust_server_certificate", v)}
              />
            </div>
            {form.trust_server_certificate && (
              <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{t("profileForm.trustCertWarning")}</span>
              </div>
            )}
            </div>

            <Field label={t("profileForm.connectionPreview")}>
              <code className="block text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 break-all">
                {connStringPreview}
              </code>
            </Field>

            {error && (
              <p role="alert" className="text-sm text-red-500 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-shrink-0 flex-col gap-3 border-t border-gray-200 px-6 py-3.5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleTest}
                disabled={testState.kind === "running" || saving}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <Zap
                  size={14}
                  className={testState.kind === "running" ? "animate-pulse text-yellow-500" : ""}
                />
                {testState.kind === "running"
                  ? t("profileForm.testInFormBusy")
                  : t("profileForm.testInForm")}
              </button>
              <div aria-live="polite" className="min-w-0">
                {testState.kind === "success" && (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 size={12} className="flex-shrink-0" />
                    {t("profileForm.testInFormSuccess")}
                  </span>
                )}
                {testState.kind === "error" && (
                  <span
                    className="flex items-start gap-1 text-xs text-red-600 dark:text-red-400 break-words"
                    title={testState.message}
                  >
                    <XCircle size={12} className="mt-0.5 flex-shrink-0" /> {testState.message}
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
              >
                {t("profileForm.cancel")}
              </button>
              <button
                type="submit"
                disabled={saving || testState.kind === "running"}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving
                  ? t("profileForm.saving")
                  : isDuplicate
                  ? t("profileForm.saveDuplicate")
                  : t("profileForm.save")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

const INPUT_CLS =
  "w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-gray-700 dark:text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-blue-500 focus:ring-blue-500"
      />
      {label}
    </label>
  );
}

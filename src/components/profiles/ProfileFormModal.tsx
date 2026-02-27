import { X } from "lucide-react";
import { useState } from "react";
import { useT } from "../../i18n";
import { useProfileStore } from "../../store/profileStore";
import type { ServerProfile } from "../../types";

interface Props {
  profile?: ServerProfile;
  onClose: () => void;
}

const DEFAULTS: Omit<ServerProfile, "id" | "name"> = {
  server: "",
  port: 1433,
  auth_type: "sqlServer",
  username: "",
  password: "",
  encrypt: true,
  trust_server_certificate: true,
};

export function ProfileFormModal({ profile, onClose }: Props) {
  const t = useT();
  const { save } = useProfileStore();
  const isNew = !profile;

  const [form, setForm] = useState<ServerProfile>(
    profile ?? { id: crypto.randomUUID(), name: "", ...DEFAULTS }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof ServerProfile, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.server || !form.username) {
      setError(t("profileForm.validationError"));
      return;
    }
    setSaving(true);
    try {
      await save(form);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const INPUT_CLS =
    "w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {isNew ? t("profileForm.titleNew") : t("profileForm.titleEdit")}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label={t("profileForm.nameLabel")}>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("profileForm.namePlaceholder")}
              className={INPUT_CLS}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label={t("profileForm.serverLabel")}>
                <input
                  value={form.server}
                  onChange={(e) => set("server", e.target.value)}
                  placeholder={t("profileForm.serverPlaceholder")}
                  className={INPUT_CLS}
                />
              </Field>
            </div>
            <Field label={t("profileForm.portLabel")}>
              <input
                type="number"
                value={form.port}
                onChange={(e) => set("port", Number(e.target.value))}
                className={INPUT_CLS}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("profileForm.usernameLabel")}>
              <input
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
            <Field label={t("profileForm.passwordLabel")}>
              <input
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
          </div>

          <div className="flex gap-6 pt-1">
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

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              {t("profileForm.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? t("profileForm.saving") : t("profileForm.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-700 dark:text-gray-400">{label}</label>
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

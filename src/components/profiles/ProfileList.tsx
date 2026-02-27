import { Plus } from "lucide-react";
import { useState } from "react";
import { useT } from "../../i18n";
import { useProfileStore } from "../../store/profileStore";
import { ProfileCard } from "./ProfileCard";
import { ProfileFormModal } from "./ProfileFormModal";
import type { ServerProfile } from "../../types";

export function ProfileList() {
  const t = useT();
  const profiles = useProfileStore((s) => s.profiles);
  const [editing, setEditing] = useState<ServerProfile | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1700px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("profiles.title")}</h2>
            <p className="text-sm text-gray-700 dark:text-gray-400 mt-0.5">
              {t("profiles.subtitle")}
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} />
            {t("profiles.newProfile")}
          </button>
        </div>

        {profiles.length === 0 ? (
          <div className="text-center py-16 text-gray-600 dark:text-gray-500">
            <p className="text-sm">{t("profiles.empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {profiles.map((p) => (
              <ProfileCard key={p.id} profile={p} onEdit={() => setEditing(p)} />
            ))}
          </div>
        )}

        {(creating || editing) && (
          <ProfileFormModal
            profile={editing ?? undefined}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

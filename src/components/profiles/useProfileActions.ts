import { useCallback, useState } from "react";
import * as api from "../../api/tauri";
import {
  useProfileSettingsStore,
  type ProfileTestStatus,
} from "../../store/profileSettingsStore";
import { useProfilesViewStore } from "../../store/profilesViewStore";
import { useUiStore } from "../../store/uiStore";
import type { ServerProfile } from "../../types";

export type LocalTestStatus = "idle" | "testing";

// Shared connect/test/pin logic for ProfileCard + ProfileRow. Keeping it here
// means both layouts agree on status persistence, recent-LRU bookkeeping, and
// the "switch tab vs open tab" behavior.
export function useProfileActions(profile: ServerProfile) {
  const openProfileTab = useUiStore((s) => s.openProfileTab);
  const setActiveProfileId = useUiStore((s) => s.setActiveProfileId);
  const connectedProfileIds = useUiStore((s) => s.connectedProfileIds);

  const lastTest = useProfileSettingsStore((s) => s.lastTestByProfile[profile.id]);
  const recordTestResult = useProfileSettingsStore((s) => s.recordTestResult);

  const isPinned = useProfilesViewStore((s) => s.pinnedProfileIds.includes(profile.id));
  const togglePinned = useProfilesViewStore((s) => s.togglePinned);
  const pushRecent = useProfilesViewStore((s) => s.pushRecent);

  const [localStatus, setLocalStatus] = useState<LocalTestStatus>("idle");

  const alreadyOpened = connectedProfileIds.includes(profile.id);

  const handleTest = useCallback(async () => {
    setLocalStatus("testing");
    try {
      await api.testConnection(profile.id);
      const status: ProfileTestStatus = {
        result: "success",
        at: new Date().toISOString(),
      };
      recordTestResult(profile.id, status);
    } catch (e) {
      recordTestResult(profile.id, {
        result: "error",
        at: new Date().toISOString(),
        error: String(e),
      });
    } finally {
      setLocalStatus("idle");
    }
  }, [profile.id, recordTestResult]);

  const handleConnect = useCallback(() => {
    pushRecent(profile.id);
    if (alreadyOpened) {
      setActiveProfileId(profile.id);
    } else {
      openProfileTab(profile.id);
    }
  }, [profile.id, alreadyOpened, openProfileTab, setActiveProfileId, pushRecent]);

  const togglePin = useCallback(() => {
    togglePinned(profile.id);
  }, [profile.id, togglePinned]);

  return {
    localStatus,
    lastTest,
    alreadyOpened,
    isPinned,
    handleTest,
    handleConnect,
    togglePin,
  };
}

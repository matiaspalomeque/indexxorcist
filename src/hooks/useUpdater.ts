import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useState, useEffect } from "react";

export function useUpdater() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    check()
      .then((result) => {
        if (result?.available) setUpdate(result);
      })
      .catch((err) => {
        console.error("[Updater] Check failed:", err);
      });
  }, []);

  const install = async () => {
    if (!update) return;
    setInstalling(true);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (err) {
      console.error("[Updater] Install failed:", err);
      setInstalling(false);
    }
  };

  return {
    update: dismissed ? null : update,
    installing,
    install,
    dismiss: () => setDismissed(true),
  };
}

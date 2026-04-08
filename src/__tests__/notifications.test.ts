import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MaintenanceSummary } from "../types";

const mockInvoke = vi.fn<(cmd: string, args?: unknown) => Promise<unknown>>();

const baseSummary: MaintenanceSummary = {
  databases_processed: 3,
  databases_failed: 0,
  databases_skipped: 0,
  total_indexes_rebuilt: 12,
  total_indexes_reorganized: 5,
  total_indexes_skipped: 8,
  total_duration_secs: 125,
  database_results: [],
};

function installNotificationSupport() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    writable: true,
    value: {},
  });
}

function removeNotificationSupport() {
  const w = window as Record<string, unknown>;
  delete w.__TAURI_INTERNALS__;
}

async function loadModule() {
  vi.doMock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
  const mod = await import("../utils/notifications");
  const { useI18nStore } = await import("../store/i18nStore");
  return { ...mod, useI18nStore };
}

// Convenience: set up invoke to grant permission on is_permission_granted,
// then no-op on notify.
function mockGranted() {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "plugin:notification|is_permission_granted") return Promise.resolve(true);
    return Promise.resolve(undefined);
  });
}

describe("notifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    installNotificationSupport();
    mockInvoke.mockReset();
  });

  it("sends finished notification when permission is already granted", async () => {
    mockGranted();
    const { notifyMaintenanceFinished, useI18nStore } = await loadModule();
    useI18nStore.setState({ lang: "en" });

    await notifyMaintenanceFinished("Production", baseSummary);

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "plugin:notification|request_permission",
      expect.anything(),
    );
    expect(mockInvoke).toHaveBeenCalledWith("plugin:notification|notify", {
      options: {
        title: "Maintenance Complete",
        body: "Production: 12 rebuilt, 5 reorganized in 2m 5s",
      },
    });
  });

  it("sends finished notification even when the app is focused", async () => {
    mockGranted();
    const { notifyMaintenanceFinished, useI18nStore } = await loadModule();
    useI18nStore.setState({ lang: "en" });

    await notifyMaintenanceFinished("Production", baseSummary);

    expect(mockInvoke).toHaveBeenCalledWith("plugin:notification|notify", expect.anything());
  });

  it("sends error notifications without requesting permission from the event handler", async () => {
    mockGranted();
    const { notifyMaintenanceError, useI18nStore } = await loadModule();
    useI18nStore.setState({ lang: "es-AR" });

    await notifyMaintenanceError("Producción", "Conexión perdida");

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "plugin:notification|request_permission",
      expect.anything(),
    );
    expect(mockInvoke).toHaveBeenCalledWith("plugin:notification|notify", {
      options: {
        title: "Error de Mantenimiento",
        body: "Producción: Conexión perdida",
      },
    });
  });

  it("formats duration correctly in notification body", async () => {
    mockGranted();
    const { notifyMaintenanceFinished } = await loadModule();

    await notifyMaintenanceFinished("Staging", {
      ...baseSummary,
      total_duration_secs: 7384,
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      "plugin:notification|notify",
      expect.objectContaining({
        options: expect.objectContaining({ body: expect.stringContaining("2h 3m") }),
      }),
    );
  });

  it("caches only granted permission for later send attempts", async () => {
    mockGranted();
    const { notifyMaintenanceFinished, notifyMaintenanceError } = await loadModule();

    await notifyMaintenanceFinished("A", baseSummary);
    await notifyMaintenanceFinished("B", baseSummary);
    await notifyMaintenanceError("C", "err");

    expect(
      mockInvoke.mock.calls.filter((c) => c[0] === "plugin:notification|is_permission_granted"),
    ).toHaveLength(1);
  });

  it("prepareNotificationPermission requests permission from the user action path", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "plugin:notification|is_permission_granted") return Promise.resolve(null);
      if (cmd === "plugin:notification|request_permission") return Promise.resolve("granted");
      return Promise.resolve(undefined);
    });
    const { prepareNotificationPermission } = await loadModule();

    await expect(prepareNotificationPermission()).resolves.toBe(true);
    await expect(prepareNotificationPermission()).resolves.toBe(true);

    expect(
      mockInvoke.mock.calls.filter((c) => c[0] === "plugin:notification|is_permission_granted"),
    ).toHaveLength(1);
    expect(
      mockInvoke.mock.calls.filter((c) => c[0] === "plugin:notification|request_permission"),
    ).toHaveLength(1);
  });

  it("does not permanently cache denied permission", async () => {
    let requestCount = 0;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "plugin:notification|is_permission_granted") return Promise.resolve(null);
      if (cmd === "plugin:notification|request_permission") {
        requestCount++;
        return Promise.resolve(requestCount === 1 ? "denied" : "granted");
      }
      return Promise.resolve(undefined);
    });
    const { prepareNotificationPermission } = await loadModule();

    await expect(prepareNotificationPermission()).resolves.toBe(false);
    await expect(prepareNotificationPermission()).resolves.toBe(true);

    expect(
      mockInvoke.mock.calls.filter((c) => c[0] === "plugin:notification|is_permission_granted"),
    ).toHaveLength(2);
    expect(
      mockInvoke.mock.calls.filter((c) => c[0] === "plugin:notification|request_permission"),
    ).toHaveLength(2);
  });

  it("send helpers skip notifications when permission is not already granted", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "plugin:notification|is_permission_granted") return Promise.resolve(false);
      return Promise.resolve(undefined);
    });
    const { notifyMaintenanceFinished, notifyMaintenanceError } = await loadModule();

    await notifyMaintenanceFinished("Production", baseSummary);
    await notifyMaintenanceError("Production", "Connection lost");

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "plugin:notification|request_permission",
      expect.anything(),
    );
    expect(mockInvoke).not.toHaveBeenCalledWith("plugin:notification|notify", expect.anything());
    expect(
      mockInvoke.mock.calls.filter((c) => c[0] === "plugin:notification|is_permission_granted"),
    ).toHaveLength(2);
  });

  it("returns false when permission preparation throws and keeps the app flow safe", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "plugin:notification|is_permission_granted") return Promise.resolve(null);
      if (cmd === "plugin:notification|request_permission")
        return Promise.reject(new Error("Permission API failed"));
      return Promise.resolve(undefined);
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { prepareNotificationPermission } = await loadModule();

    await expect(prepareNotificationPermission()).resolves.toBe(false);

    expect(warnSpy).toHaveBeenCalled();
  });

  it("returns false and avoids IPC calls when notifications are unsupported", async () => {
    removeNotificationSupport();
    const { prepareNotificationPermission, notifyMaintenanceFinished } = await loadModule();

    await expect(prepareNotificationPermission()).resolves.toBe(false);
    await notifyMaintenanceFinished("Production", baseSummary);

    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

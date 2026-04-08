import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSelector } from "../components/databases/DatabaseSelector";
import * as api from "../api/tauri";
import { useDatabaseSelectionStore } from "../store/databaseSelectionStore";
import { _resetBatchQueue, useMaintenanceStore } from "../store/maintenanceStore";
import { useI18nStore } from "../store/i18nStore";
import { useProfileSettingsStore } from "../store/profileSettingsStore";
import { useProfileStore } from "../store/profileStore";
import { useUiStore } from "../store/uiStore";
import type { ServerProfile } from "../types";
import { prepareNotificationPermission } from "../utils/notifications";

vi.mock("../api/tauri", () => ({
  runMaintenance: vi.fn(),
  getDatabases: vi.fn(),
}));

vi.mock("../utils/notifications", () => ({
  prepareNotificationPermission: vi.fn(),
}));

const mockRunMaintenance = vi.mocked(api.runMaintenance);
const mockPrepareNotificationPermission = vi.mocked(prepareNotificationPermission);

const profile: ServerProfile = {
  id: "profile-1",
  name: "Production",
  server: "sql.example.local",
  port: 1433,
  auth_type: "sqlServer",
  username: "sa",
  password: "secret",
  encrypt: false,
  trust_server_certificate: true,
};

describe("DatabaseSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetBatchQueue();

    useI18nStore.setState({ lang: "en" });
    useProfileStore.setState({ profiles: [profile], loading: false });
    useUiStore.setState({
      currentView: "databases",
      activeProfileId: profile.id,
      profileViews: { [profile.id]: "databases" },
      connectedProfileIds: [profile.id],
    });
    useDatabaseSelectionStore.setState({
      byProfile: {
        [profile.id]: {
          databases: ["db_main", "db_reporting"],
          selected: ["db_main"],
        },
      },
    });
    useProfileSettingsStore.setState({ byProfile: {} });
    useMaintenanceStore.setState({ byProfile: {} });

    mockRunMaintenance.mockResolvedValue(undefined);
  });

  it("prepares notification permission before starting maintenance", async () => {
    mockPrepareNotificationPermission.mockResolvedValue(true);
    const user = userEvent.setup();

    render(<DatabaseSelector />);
    await user.click(screen.getByRole("button", { name: /Start Maintenance/i }));

    await waitFor(() => {
      expect(mockPrepareNotificationPermission).toHaveBeenCalledOnce();
      expect(mockRunMaintenance).toHaveBeenCalledOnce();
    });
  });

  it("still starts maintenance when permission preparation returns false", async () => {
    mockPrepareNotificationPermission.mockResolvedValue(false);
    const user = userEvent.setup();

    render(<DatabaseSelector />);
    await user.click(screen.getByRole("button", { name: /Start Maintenance/i }));

    await waitFor(() => {
      expect(mockPrepareNotificationPermission).toHaveBeenCalledOnce();
      expect(mockRunMaintenance).toHaveBeenCalledWith(
        profile.id,
        ["db_main"],
        expect.objectContaining({ parallel_databases: false }),
      );
    });
  });
});

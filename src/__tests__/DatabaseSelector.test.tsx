import { render, screen, waitFor, within } from "@testing-library/react";
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
  getRunHistory: vi.fn(),
}));

vi.mock("../utils/notifications", () => ({
  prepareNotificationPermission: vi.fn(),
}));

const mockRunMaintenance = vi.mocked(api.runMaintenance);
const mockGetRunHistory = vi.mocked(api.getRunHistory);
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
    mockGetRunHistory.mockResolvedValue([]);
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

  it("can show only selected databases and invert visible selection", async () => {
    const user = userEvent.setup();

    render(<DatabaseSelector />);

    expect(screen.getByText("db_main")).toBeInTheDocument();
    expect(screen.getByText("db_reporting")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Selected only/i }));

    expect(screen.getByText("db_main")).toBeInTheDocument();
    expect(screen.queryByText("db_reporting")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Show all/i }));
    await user.click(screen.getByRole("button", { name: /Invert visible/i }));

    expect(useDatabaseSelectionStore.getState().byProfile[profile.id].selected).toEqual([
      "db_reporting",
    ]);
  });

  it("switches settings categories in the desktop inspector", async () => {
    const user = userEvent.setup();

    render(<DatabaseSelector />);

    const inspector = screen.getByRole("complementary");
    const connectionTab = within(inspector).getByRole("tab", { name: "Connection" });
    const retryTab = within(inspector).getByRole("tab", { name: "Retry" });

    expect(within(inspector).getByRole("tab", { name: "Maintenance" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(connectionTab);
    expect(connectionTab).toHaveAttribute("aria-selected", "true");
    expect(
      within(inspector).getByRole("spinbutton", { name: "Connection timeout (ms)" }),
    ).toHaveValue(30000);

    await user.click(retryTab);
    expect(retryTab).toHaveAttribute("aria-selected", "true");
    expect(within(inspector).getByRole("spinbutton", { name: "Max attempts" })).toHaveValue(3);
  });
});

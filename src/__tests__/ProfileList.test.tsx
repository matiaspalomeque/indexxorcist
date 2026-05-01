import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/tauri";
import { ProfileList } from "../components/profiles/ProfileList";
import { useDatabaseSelectionStore } from "../store/databaseSelectionStore";
import { useHistoryStore } from "../store/historyStore";
import { useI18nStore } from "../store/i18nStore";
import { useMaintenanceStore } from "../store/maintenanceStore";
import { useProfileSettingsStore } from "../store/profileSettingsStore";
import { useProfileStore } from "../store/profileStore";
import { useProfilesViewStore } from "../store/profilesViewStore";
import { useUiStore } from "../store/uiStore";
import type { ServerProfile } from "../types";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock("../api/tauri", () => ({
  getRunHistory: vi.fn(),
  clearRunHistory: vi.fn(),
  getServerProfiles: vi.fn(),
  saveServerProfile: vi.fn(),
  duplicateServerProfile: vi.fn(),
  deleteServerProfile: vi.fn(),
  testConnection: vi.fn(),
}));

const mockGetRunHistory = vi.mocked(api.getRunHistory);
const mockClearRunHistory = vi.mocked(api.clearRunHistory);
const mockGetServerProfiles = vi.mocked(api.getServerProfiles);
const mockDeleteServerProfile = vi.mocked(api.deleteServerProfile);

const profile: ServerProfile = {
  id: "profile-1",
  name: "Production",
  server: "sql.example.local",
  port: 1433,
  auth_type: "sqlServer",
  username: "sa",
  password: "",
  encrypt: true,
  trust_server_certificate: false,
  environment: "production",
};

const developmentProfile: ServerProfile = {
  ...profile,
  id: "profile-2",
  name: "Alpha Development",
  server: "dev.example.local",
  environment: "development",
};

const productionProfile: ServerProfile = {
  ...profile,
  id: "profile-3",
  name: "Zeta Production",
  server: "prod.example.local",
  environment: "production",
};

function resetStores(profiles: ServerProfile[]) {
  useProfileStore.setState({ profiles, loading: false });
  useHistoryStore.setState({
    records: [],
    loading: false,
    error: null,
    loadedLimit: 0,
    clearGen: 0,
    inFlight: 0,
  });
  useProfileSettingsStore.setState({ byProfile: {}, lastTestByProfile: {} });
  useProfilesViewStore.setState({
    pinnedProfileIds: [],
    recentProfileIds: [],
    manualOrder: [],
    viewMode: "grid",
    groupByEnv: false,
    sortMode: "lastUsed",
  });
  useUiStore.setState({
    currentView: "profiles",
    activeProfileId: null,
    profileViews: {},
    connectedProfileIds: [],
  });
  useDatabaseSelectionStore.setState({ byProfile: {} });
  useMaintenanceStore.setState({ byProfile: {} });
  useI18nStore.setState({ lang: "en" });
}

describe("ProfileList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.body.innerHTML = "";
    let diskProfiles = [profile];
    mockGetRunHistory.mockResolvedValue([]);
    mockClearRunHistory.mockResolvedValue(undefined);
    mockGetServerProfiles.mockImplementation(async () => diskProfiles);
    mockDeleteServerProfile.mockImplementation(async (id) => {
      diskProfiles = diskProfiles.filter((p) => p.id !== id);
    });
    resetStores(diskProfiles);
  });

  it("clears the deleted profile history after a single-profile delete", async () => {
    const user = userEvent.setup();

    render(<ProfileList />);

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete Profile" }));

    await waitFor(() => {
      expect(mockDeleteServerProfile).toHaveBeenCalledWith("profile-1");
    });
    expect(mockClearRunHistory).toHaveBeenCalledWith("profile-1");
    expect(mockGetRunHistory).toHaveBeenCalledTimes(2);
  });

  it("keeps the selected sort mode after leaving and returning to profiles", async () => {
    const user = userEvent.setup();
    resetStores([developmentProfile, productionProfile]);

    const { unmount } = render(<ProfileList />);

    await user.click(screen.getByRole("combobox", { name: "Sort" }));
    await user.click(screen.getByRole("option", { name: "Environment" }));

    expect(screen.getByRole("combobox", { name: "Sort" })).toHaveTextContent("Environment");
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)
    ).toEqual(["Zeta Production", "Alpha Development"]);

    unmount();
    render(<ProfileList />);

    expect(screen.getByRole("combobox", { name: "Sort" })).toHaveTextContent("Environment");
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)
    ).toEqual(["Zeta Production", "Alpha Development"]);
  });
});

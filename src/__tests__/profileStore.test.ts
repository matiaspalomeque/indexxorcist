import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/tauri";
import { useProfileSettingsStore } from "../store/profileSettingsStore";
import { useProfileStore } from "../store/profileStore";
import { DEFAULT_OPTIONS, type ServerProfile } from "../types";

vi.mock("../api/tauri", () => ({
  getServerProfiles: vi.fn(),
  saveServerProfile: vi.fn(),
  duplicateServerProfile: vi.fn(),
  deleteServerProfile: vi.fn(),
}));

const mockGetServerProfiles = vi.mocked(api.getServerProfiles);
const mockSaveServerProfile = vi.mocked(api.saveServerProfile);
const mockDuplicateServerProfile = vi.mocked(api.duplicateServerProfile);

const sourceProfile: ServerProfile = {
  id: "profile-1",
  name: "Production",
  server: "sql.example.local",
  port: 1433,
  auth_type: "sqlServer",
  username: "sa",
  password: "",
  encrypt: true,
  trust_server_certificate: true,
};

describe("profileStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useProfileStore.setState({ profiles: [sourceProfile], loading: false });
    useProfileSettingsStore.setState({ byProfile: {} });
  });

  it("duplicates a profile through the backend and clones its settings to the new id", async () => {
    const duplicateProfile: ServerProfile = {
      ...sourceProfile,
      id: "profile-2",
      name: "Production Copy",
      password: "",
    };
    const customSettings = {
      ...DEFAULT_OPTIONS,
      rebuild_threshold: 40,
      parallel_databases: true,
      max_parallel_databases: 8,
    };

    useProfileSettingsStore.setState({
      byProfile: {
        [sourceProfile.id]: customSettings,
      },
    });
    mockDuplicateServerProfile.mockResolvedValue(undefined);
    mockGetServerProfiles.mockResolvedValue([sourceProfile, duplicateProfile]);

    await useProfileStore.getState().duplicate(sourceProfile.id, duplicateProfile);

    expect(mockDuplicateServerProfile).toHaveBeenCalledWith(sourceProfile.id, duplicateProfile);
    expect(useProfileSettingsStore.getState().byProfile[sourceProfile.id]).toEqual(customSettings);
    expect(useProfileSettingsStore.getState().byProfile[duplicateProfile.id]).toEqual(customSettings);
    expect(useProfileStore.getState().profiles).toEqual([sourceProfile, duplicateProfile]);
  });

  it("imports prepared profiles as new copies and writes their settings under the new ids", async () => {
    const existingSettings = { ...DEFAULT_OPTIONS, retry_max_attempts: 5 };
    const imported = [
      {
        profile: {
          ...sourceProfile,
          id: "import-1",
          name: "Production (Imported)",
          password: "",
        },
        settings: { ...DEFAULT_OPTIONS, rebuild_threshold: 50 },
      },
      {
        profile: {
          ...sourceProfile,
          id: "import-2",
          name: "Staging",
          server: "staging.example.local",
          password: "",
        },
        settings: { ...DEFAULT_OPTIONS, parallel_databases: true, max_parallel_databases: 6 },
      },
    ];

    useProfileSettingsStore.setState({
      byProfile: {
        [sourceProfile.id]: existingSettings,
      },
    });
    mockSaveServerProfile.mockResolvedValue(undefined);
    mockGetServerProfiles.mockResolvedValue([
      sourceProfile,
      imported[0].profile,
      imported[1].profile,
    ]);

    await useProfileStore.getState().importProfiles(imported);

    expect(mockSaveServerProfile).toHaveBeenCalledTimes(2);
    expect(mockSaveServerProfile).toHaveBeenNthCalledWith(1, imported[0].profile);
    expect(mockSaveServerProfile).toHaveBeenNthCalledWith(2, imported[1].profile);
    expect(useProfileSettingsStore.getState().byProfile[sourceProfile.id]).toEqual(existingSettings);
    expect(useProfileSettingsStore.getState().byProfile["import-1"]).toEqual(imported[0].settings);
    expect(useProfileSettingsStore.getState().byProfile["import-2"]).toEqual(imported[1].settings);
    expect(useProfileStore.getState().profiles).toEqual([
      sourceProfile,
      imported[0].profile,
      imported[1].profile,
    ]);
  });
});

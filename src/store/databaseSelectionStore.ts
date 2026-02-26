import { create } from "zustand";

interface ProfileDatabaseSelection {
  databases: string[];
  selected: string[];
}

interface DatabaseSelectionState {
  byProfile: Record<string, ProfileDatabaseSelection>;
  setDatabasesForProfile: (profileId: string, databases: string[]) => void;
  setSelectedForProfile: (profileId: string, selected: string[]) => void;
  clearProfileSelection: (profileId: string) => void;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function emptySelection(): ProfileDatabaseSelection {
  return {
    databases: [],
    selected: [],
  };
}

function getProfileSelection(
  byProfile: Record<string, ProfileDatabaseSelection>,
  profileId: string
): ProfileDatabaseSelection {
  return byProfile[profileId] ?? emptySelection();
}

export const useDatabaseSelectionStore = create<DatabaseSelectionState>((set) => ({
  byProfile: {},

  setDatabasesForProfile: (profileId, databases) =>
    set((s) => {
      const current = getProfileSelection(s.byProfile, profileId);
      const nextDatabases = unique(databases);
      const hadAllSelected =
        current.databases.length > 0 && current.selected.length === current.databases.length;

      const nextSelected =
        current.selected.length === 0 || hadAllSelected
          ? nextDatabases
          : nextDatabases.filter((db) => current.selected.includes(db));

      return {
        byProfile: {
          ...s.byProfile,
          [profileId]: {
            ...current,
            databases: nextDatabases,
            selected: nextSelected,
          },
        },
      };
    }),

  setSelectedForProfile: (profileId, selected) =>
    set((s) => {
      const current = getProfileSelection(s.byProfile, profileId);
      const allowed = new Set(current.databases);

      return {
        byProfile: {
          ...s.byProfile,
          [profileId]: {
            ...current,
            selected: unique(selected).filter((db) => allowed.has(db)),
          },
        },
      };
    }),

  clearProfileSelection: (profileId) =>
    set((s) => {
      const { [profileId]: _, ...rest } = s.byProfile;
      return { byProfile: rest };
    }),
}));

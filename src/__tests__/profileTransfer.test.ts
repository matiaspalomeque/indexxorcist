import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, type ServerProfile } from "../types";
import {
  buildProfileTransferBundle,
  createDuplicateProfileName,
  createImportedProfileName,
  parseProfileTransferBundle,
  prepareImportedProfiles,
  serializeProfileTransferBundle,
} from "../utils/profileTransfer";

const baseProfile: ServerProfile = {
  id: "profile-1",
  name: "Production",
  server: "sql.example.local",
  port: 1433,
  auth_type: "sqlServer",
  username: "sa",
  password: "secret",
  encrypt: true,
  trust_server_certificate: false,
};

describe("profileTransfer", () => {
  it("deduplicates duplicate profile names with copy suffixes", () => {
    expect(
      createDuplicateProfileName("Production", ["Production", "Production Copy"])
    ).toBe("Production Copy 2");
  });

  it("deduplicates imported profile names with imported suffixes", () => {
    expect(
      createImportedProfileName("Production", [
        "Production",
        "Production (Imported)",
        "Production (Imported 2)",
      ])
    ).toBe("Production (Imported 3)");
  });

  it("builds a bundle without ids or passwords and with resolved settings", () => {
    const settings = {
      ...DEFAULT_OPTIONS,
      rebuild_threshold: 42,
      parallel_databases: true,
      max_parallel_databases: 6,
    };

    const bundle = buildProfileTransferBundle([baseProfile], () => settings);

    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.profiles).toEqual([
      {
        name: "Production",
        server: "sql.example.local",
        port: 1433,
        auth_type: "sqlServer",
        username: "sa",
        encrypt: true,
        trust_server_certificate: false,
        settings,
      },
    ]);
    expect(JSON.stringify(bundle)).not.toContain("secret");
    expect(JSON.stringify(bundle)).not.toContain('"id"');
  });

  it("parses a valid serialized bundle", () => {
    const bundle = buildProfileTransferBundle([baseProfile], () => DEFAULT_OPTIONS);
    const parsed = parseProfileTransferBundle(serializeProfileTransferBundle(bundle));

    expect(parsed).toEqual(bundle);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseProfileTransferBundle("{not-json")).toThrow(
      "Invalid import file: the selected file is not valid JSON."
    );
  });

  it("rejects unsupported schema versions", () => {
    expect(() =>
      parseProfileTransferBundle(
        JSON.stringify({ schemaVersion: 99, exportedAt: "2026-01-01T00:00:00Z", profiles: [] })
      )
    ).toThrow("Unsupported import file version");
  });

  it("prepares imported profiles with blank passwords, new ids, and deduplicated names", () => {
    const parsed = parseProfileTransferBundle(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: "2026-01-01T00:00:00Z",
        profiles: [
          {
            name: "Production",
            server: "sql.example.local",
            port: 1433,
            auth_type: "sqlServer",
            username: "sa",
            encrypt: true,
            trust_server_certificate: true,
            settings: DEFAULT_OPTIONS,
          },
          {
            name: "Production",
            server: "sql-2.example.local",
            port: 1434,
            auth_type: "sqlServer",
            username: "reporting",
            encrypt: false,
            trust_server_certificate: false,
            settings: { ...DEFAULT_OPTIONS, rebuild_threshold: 55 },
          },
        ],
      })
    );

    let nextId = 0;
    const prepared = prepareImportedProfiles(parsed, ["Production"], () => `import-${++nextId}`);

    expect(prepared).toEqual([
      {
        profile: {
          id: "import-1",
          name: "Production (Imported)",
          server: "sql.example.local",
          port: 1433,
          auth_type: "sqlServer",
          username: "sa",
          password: "",
          encrypt: true,
          trust_server_certificate: true,
        },
        settings: DEFAULT_OPTIONS,
      },
      {
        profile: {
          id: "import-2",
          name: "Production (Imported 2)",
          server: "sql-2.example.local",
          port: 1434,
          auth_type: "sqlServer",
          username: "reporting",
          password: "",
          encrypt: false,
          trust_server_certificate: false,
        },
        settings: { ...DEFAULT_OPTIONS, rebuild_threshold: 55 },
      },
    ]);
  });
});

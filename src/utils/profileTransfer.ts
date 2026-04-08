import type { MaintenanceOptions, ServerProfile } from "../types";

export const PROFILE_TRANSFER_SCHEMA_VERSION = 1;

const SUPPORTED_AUTH_TYPES = new Set(["sqlServer"]);

export interface ProfileTransferEntryV1 {
  name: string;
  server: string;
  port: number;
  auth_type: ServerProfile["auth_type"];
  username: string;
  encrypt: boolean;
  trust_server_certificate: boolean;
  settings: MaintenanceOptions;
}

export interface ProfileTransferBundleV1 {
  schemaVersion: typeof PROFILE_TRANSFER_SCHEMA_VERSION;
  exportedAt: string;
  profiles: ProfileTransferEntryV1[];
}

export interface PreparedImportedProfile {
  profile: ServerProfile;
  settings: MaintenanceOptions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFiniteNumber(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid import file: "${key}" must be a finite number.`);
  }
  return value;
}

function parseBoolean(value: unknown, key: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid import file: "${key}" must be a boolean.`);
  }
  return value;
}

function parseString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid import file: "${key}" must be a non-empty string.`);
  }
  return value;
}

function parseSettings(value: unknown): MaintenanceOptions {
  if (!isRecord(value)) {
    throw new Error('Invalid import file: "settings" must be an object.');
  }

  return {
    rebuild_online: parseBoolean(value.rebuild_online, "settings.rebuild_online"),
    free_proc_cache: parseBoolean(value.free_proc_cache, "settings.free_proc_cache"),
    parallel_databases: parseBoolean(value.parallel_databases, "settings.parallel_databases"),
    rebuild_threshold: parseFiniteNumber(value.rebuild_threshold, "settings.rebuild_threshold"),
    reorganize_threshold: parseFiniteNumber(
      value.reorganize_threshold,
      "settings.reorganize_threshold"
    ),
    retry_max_attempts: parseFiniteNumber(
      value.retry_max_attempts,
      "settings.retry_max_attempts"
    ),
    retry_base_delay_ms: parseFiniteNumber(
      value.retry_base_delay_ms,
      "settings.retry_base_delay_ms"
    ),
    retry_max_delay_ms: parseFiniteNumber(
      value.retry_max_delay_ms,
      "settings.retry_max_delay_ms"
    ),
    connection_timeout_ms: parseFiniteNumber(
      value.connection_timeout_ms,
      "settings.connection_timeout_ms"
    ),
    request_timeout_ms: parseFiniteNumber(
      value.request_timeout_ms,
      "settings.request_timeout_ms"
    ),
    max_parallel_databases: parseFiniteNumber(
      value.max_parallel_databases,
      "settings.max_parallel_databases"
    ),
  };
}

function parseTransferEntry(value: unknown): ProfileTransferEntryV1 {
  if (!isRecord(value)) {
    throw new Error("Invalid import file: each profile entry must be an object.");
  }

  const authType = parseString(value.auth_type, "auth_type");
  if (!SUPPORTED_AUTH_TYPES.has(authType)) {
    throw new Error(
      `Invalid import file: auth type "${authType}" is not supported by this app version.`
    );
  }

  return {
    name: parseString(value.name, "name"),
    server: parseString(value.server, "server"),
    port: parseFiniteNumber(value.port, "port"),
    auth_type: authType as ServerProfile["auth_type"],
    username: parseString(value.username, "username"),
    encrypt: parseBoolean(value.encrypt, "encrypt"),
    trust_server_certificate: parseBoolean(
      value.trust_server_certificate,
      "trust_server_certificate"
    ),
    settings: parseSettings(value.settings),
  };
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function makeNameSet(names: Iterable<string>): Set<string> {
  return new Set(Array.from(names, normalizeName));
}

function dedupeName(
  existingNames: Iterable<string>,
  format: (n: number) => string,
): string {
  const taken = makeNameSet(existingNames);
  let n = 1;
  while (taken.has(normalizeName(format(n)))) n += 1;
  return format(n);
}

export function createDuplicateProfileName(
  sourceName: string,
  existingNames: Iterable<string>,
): string {
  return dedupeName(existingNames, (n) =>
    n === 1 ? `${sourceName} Copy` : `${sourceName} Copy ${n}`,
  );
}

export function createImportedProfileName(
  name: string,
  existingNames: Iterable<string>,
): string {
  return dedupeName(existingNames, (n) => {
    if (n === 1) return name;
    if (n === 2) return `${name} (Imported)`;
    return `${name} (Imported ${n - 1})`;
  });
}

export function buildProfileTransferBundle(
  profiles: readonly ServerProfile[],
  getSettings: (profileId: string) => MaintenanceOptions
): ProfileTransferBundleV1 {
  return {
    schemaVersion: PROFILE_TRANSFER_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profiles: profiles.map((profile) => ({
      name: profile.name,
      server: profile.server,
      port: profile.port,
      auth_type: profile.auth_type,
      username: profile.username,
      encrypt: profile.encrypt,
      trust_server_certificate: profile.trust_server_certificate,
      settings: getSettings(profile.id),
    })),
  };
}

export function serializeProfileTransferBundle(
  bundle: ProfileTransferBundleV1
): string {
  return JSON.stringify(bundle, null, 2);
}

export function parseProfileTransferBundle(json: string): ProfileTransferBundleV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid import file: the selected file is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new Error("Invalid import file: expected an object at the top level.");
  }

  if (parsed.schemaVersion !== PROFILE_TRANSFER_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported import file version: expected schemaVersion ${PROFILE_TRANSFER_SCHEMA_VERSION}.`
    );
  }

  if (typeof parsed.exportedAt !== "string" || parsed.exportedAt.trim() === "") {
    throw new Error('Invalid import file: "exportedAt" is required.');
  }

  if (!Array.isArray(parsed.profiles)) {
    throw new Error('Invalid import file: "profiles" must be an array.');
  }

  return {
    schemaVersion: PROFILE_TRANSFER_SCHEMA_VERSION,
    exportedAt: parsed.exportedAt,
    profiles: parsed.profiles.map(parseTransferEntry),
  };
}

export function prepareImportedProfiles(
  bundle: ProfileTransferBundleV1,
  existingNames: Iterable<string>,
  createId: () => string = () => crypto.randomUUID()
): PreparedImportedProfile[] {
  const takenNames = new Set(Array.from(existingNames));

  return bundle.profiles.map((entry) => {
    const name = createImportedProfileName(entry.name, takenNames);
    takenNames.add(name);

    return {
      profile: {
        id: createId(),
        name,
        server: entry.server,
        port: entry.port,
        auth_type: entry.auth_type,
        username: entry.username,
        password: "",
        encrypt: entry.encrypt,
        trust_server_certificate: entry.trust_server_certificate,
      },
      settings: { ...entry.settings },
    };
  });
}

export function sanitizeFilenameSegment(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return sanitized || "profile";
}

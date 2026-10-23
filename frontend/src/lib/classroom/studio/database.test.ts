// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rootCertificates } from "node:tls";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ postgres: vi.fn(), query: vi.fn(), end: vi.fn(async () => {}) }));
vi.mock("postgres", () => ({ default: mocks.postgres }));
import { closeDatabases, database } from "./database";
const identity = (role = "classroom_reader") => ({ effective_role: role, authenticated_role: role,
  rolsuper: false, rolcreaterole: false, rolcreatedb: false, rolreplication: false, rolbypassrls: false, rolinherit: false });
beforeEach(() => {
  mocks.postgres.mockReturnValue(Object.assign(mocks.query, { end: mocks.end }));
  mocks.query.mockResolvedValue([identity()]);
});
afterEach(async () => { await closeDatabases(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
function remote() {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("CLASSROOM_CONTENT_SOURCE", "seed");
  vi.stubEnv("CLASSROOM_DATABASE_READER_URL", "postgres://classroom_reader.example:synthetic@pooler.example.com:6543/postgres?sslmode=no-verify");
  vi.stubEnv("CLASSROOM_DATABASE_CA_CERT", "");
}
describe("Studio server database identity and TLS", () => {
  it("enforces certificate verification regardless of URL SSL parameters", async () => {
    remote(); await database("reader");
    expect(mocks.postgres).toHaveBeenCalledWith(expect.not.stringContaining("sslmode"), expect.objectContaining({ ssl: { rejectUnauthorized: true }, prepare: false }));
  });
  it("uses the configured CA while retaining certificate verification", async () => {
    remote(); vi.stubEnv("CLASSROOM_DATABASE_CA_CERT", rootCertificates[0]); await database("reader");
    expect(mocks.postgres).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ ssl: { rejectUnauthorized: true, ca: rootCertificates[0] } }));
  });
  it("rejects malformed CA configuration without exposing values", async () => {
    remote(); vi.stubEnv("CLASSROOM_DATABASE_CA_CERT", "PRIVATE_CONFIGURATION_CANARY");
    await expect(database("reader")).rejects.toThrow("Exercise storage is unavailable.");
    expect(mocks.postgres).not.toHaveBeenCalled();
  });
  it("rejects oversized CA configuration", async () => {
    remote(); vi.stubEnv("CLASSROOM_DATABASE_CA_CERT", "x".repeat(65537));
    await expect(database("reader")).rejects.toThrow("Exercise storage is unavailable.");
    expect(mocks.postgres).not.toHaveBeenCalled();
  });
  it("requires the exact Production role and validates the authenticated identity", async () => {
    remote(); vi.stubEnv("VERCEL_ENV", "production");
    await expect(database("reader")).rejects.toThrow("Exercise storage is unavailable.");
    expect(mocks.postgres).not.toHaveBeenCalled();
    vi.stubEnv("CLASSROOM_DATABASE_READER_URL", "postgres://classroom_reader_production.example:synthetic@pooler.example.com:6543/postgres");
    mocks.query.mockResolvedValue([identity("classroom_reader_production")]);
    await expect(database("reader")).resolves.toBe(mocks.query);
  });
  it.each(["postgres", "classroom_writer_production", "classroom_reader_production_untrusted"])("rejects a wrong configured reader role: %s", async (role) => {
    remote(); vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("CLASSROOM_DATABASE_READER_URL", `postgres://${role}.example:synthetic@pooler.example.com:6543/postgres`);
    await expect(database("reader")).rejects.toThrow("Exercise storage is unavailable.");
    expect(mocks.postgres).not.toHaveBeenCalled();
  });
  it.each(["effective_role", "authenticated_role", "rolsuper", "rolbypassrls"])("fails closed on an unexpected authenticated role/flag: %s", async (field) => {
    remote(); mocks.query.mockResolvedValue([{ ...identity(), [field]: field.endsWith("role") ? "postgres" : true }]);
    await expect(database("reader")).rejects.toThrow("Exercise storage is unavailable.");
    expect(mocks.end).toHaveBeenCalled();
    mocks.query.mockResolvedValue([identity()]);
    await expect(database("reader")).resolves.toBe(mocks.query);
  });
});

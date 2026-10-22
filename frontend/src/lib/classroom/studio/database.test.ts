// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { rootCertificates } from "node:tls";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ postgres: vi.fn(() => ({ end: vi.fn(async () => {}) })) }));
vi.mock("postgres", () => ({ default: mocks.postgres }));
import { closeDatabases, database } from "./database";
afterEach(async () => { await closeDatabases(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
function remote() {
  vi.stubEnv("CLASSROOM_CONTENT_SOURCE", "seed");
  vi.stubEnv("CLASSROOM_DATABASE_READER_URL", "postgres://classroom_reader.example:synthetic@pooler.example.com:6543/postgres?sslmode=no-verify");
  vi.stubEnv("CLASSROOM_DATABASE_CA_CERT", "");
}
describe("Studio server database TLS", () => {
  it("enforces certificate verification regardless of URL SSL parameters", () => {
    remote(); database("reader");
    expect(mocks.postgres).toHaveBeenCalledWith(expect.not.stringContaining("sslmode"), expect.objectContaining({ ssl: { rejectUnauthorized: true }, prepare: false }));
  });
  it("uses the configured CA while retaining certificate verification", () => {
    remote(); vi.stubEnv("CLASSROOM_DATABASE_CA_CERT", rootCertificates[0]); database("reader");
    expect(mocks.postgres).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ ssl: { rejectUnauthorized: true, ca: rootCertificates[0] } }));
  });
  it("rejects malformed CA configuration without exposing values", () => {
    remote(); vi.stubEnv("CLASSROOM_DATABASE_CA_CERT", "PRIVATE_CONFIGURATION_CANARY");
    expect(() => database("reader")).toThrow("Exercise storage is unavailable.");
    expect(mocks.postgres).not.toHaveBeenCalled();
  });
  it("rejects oversized CA configuration", () => {
    remote(); vi.stubEnv("CLASSROOM_DATABASE_CA_CERT", "x".repeat(65537));
    expect(() => database("reader")).toThrow("Exercise storage is unavailable.");
    expect(mocks.postgres).not.toHaveBeenCalled();
  });
});

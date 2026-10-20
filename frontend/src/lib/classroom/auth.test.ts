// @vitest-environment node
import { randomBytes, scryptSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  connection: async () => {},
}));
const state = vi.hoisted(() => ({ cookie: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookie ? { value: state.cookie } : undefined),
  }),
}));
import {
  authConfig,
  allowLoginAttempt,
  PasswordCheckBusy,
  createSession,
  isTeacher,
  sameOrigin,
  SESSION_SECONDS,
  validSession,
  verifyPassword,
} from "./auth";
import records from "../../../content/classroom/exercises.json";
import { makeTestGuides } from "@/test/classroomFixtures";
import { parseExercises } from "./schema";
import { POST as login } from "@/app/classroom/session/route";
import { POST as logout } from "@/app/classroom/logout/route";
import { GET as guide } from "@/app/classroom/api/guide/[slug]/route";

const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = `${salt}:${scryptSync(password, salt, 64, { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 }).toString("hex")}`;
const origin = "https://classroom.example";
function request(path: string, body = "", source = origin) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: {
      origin: source,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
}
beforeEach(() => {
  vi.stubEnv("CLASSROOM_PASSWORD_HASH", hash);
  vi.stubEnv("CLASSROOM_SESSION_SECRET", "a".repeat(96));
  vi.stubEnv("CLASSROOM_ORIGIN", origin);
  vi.stubEnv(
    "CLASSROOM_GUIDES_JSON",
    JSON.stringify(makeTestGuides(parseExercises(records))),
  );
  state.cookie = undefined;
});
afterEach(() => vi.unstubAllEnvs());

describe("Teacher authentication and authorization", () => {
  it("fails closed for missing or malformed configuration and foreign origins", async () => {
    vi.stubEnv("CLASSROOM_SESSION_SECRET", "");
    expect(authConfig()).toBeNull();
    expect(validSession("anything")).toBe(false);
    expect((await login(request("/classroom/session"))).status).toBe(503);
    vi.stubEnv("CLASSROOM_SESSION_SECRET", "a".repeat(96));
    vi.stubEnv("CLASSROOM_ORIGIN", "http://public.example");
    expect(authConfig()).toBeNull();
    vi.stubEnv("CLASSROOM_ORIGIN", origin);
    expect(sameOrigin(request("/", "", "https://evil.example"))).toBe(false);
    expect(
      (await login(request("/classroom/session", "", "https://evil.example")))
        .status,
    ).toBe(403);
    expect(
      (await logout(request("/classroom/logout", "", "https://evil.example")))
        .status,
    ).toBe(403);
  });
  it("rejects insecure loopback configuration on a hosted Vercel deployment", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CLASSROOM_ORIGIN", "http://localhost:3000");
    expect(authConfig()).toBeNull();
  });
  it("binds preview CSRF and sessions to the platform branch origin, never a request host", () => {
    vi.stubEnv("CLASSROOM_ORIGIN", "");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv(
      "VERCEL_BRANCH_URL",
      "stackspeak-git-classroom-example.vercel.app",
    );
    const expected = "https://stackspeak-git-classroom-example.vercel.app";
    expect(authConfig()?.origin).toBe(expected);
    expect(sameOrigin(request("/", "", expected))).toBe(true);
    expect(sameOrigin(request("/", "", origin))).toBe(false);
    const token = createSession();
    vi.stubEnv("VERCEL_BRANCH_URL", "other-preview.vercel.app");
    expect(validSession(token)).toBe(false);
    for (const host of [
      "evil.example",
      "valid.vercel.app/",
      "evil@valid.vercel.app",
      "",
    ]) {
      vi.stubEnv("VERCEL_BRANCH_URL", host);
      expect(authConfig()).toBeNull();
    }
  });
  it("does not infer production or local origins from Vercel metadata", () => {
    vi.stubEnv("CLASSROOM_ORIGIN", "");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv(
      "VERCEL_BRANCH_URL",
      "stackspeak-git-classroom-example.vercel.app",
    );
    expect(authConfig()).toBeNull();
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL", "");
    expect(authConfig()).toBeNull();
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CLASSROOM_ORIGIN", origin);
    expect(authConfig()?.origin).toBe(origin);
  });
  it("checks passwords server-side, signs expiring cookies, rejects tampering and key rotation", async () => {
    expect(await verifyPassword(password)).toBe(true);
    expect(await verifyPassword("wrong")).toBe(false);
    const now = 1792454400000;
    const token = createSession(now);
    expect(validSession(token, now)).toBe(true);
    expect(validSession(token, now + SESSION_SECONDS * 1000)).toBe(false);
    expect(validSession(token, now - 1000)).toBe(false);
    expect(
      validSession(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"), now),
    ).toBe(false);
    vi.stubEnv(
      "CLASSROOM_PASSWORD_HASH",
      `${"b".repeat(32)}:${"c".repeat(128)}`,
    );
    expect(validSession(token, now)).toBe(false);
  });
  it("protects guide API before content lookup, uses no-store, and clears cookies on logout", async () => {
    const context = {
      params: Promise.resolve({ slug: "python-loop-accumulator" }),
    };
    const denied = await guide(
      new Request(`${origin}/classroom/api/guide/python-loop-accumulator`),
      context,
    );
    expect(denied.status).toBe(401);
    expect(await denied.text()).not.toContain("spokenExample");
    state.cookie = createSession();
    expect(await isTeacher()).toBe(true);
    const response = await guide(
      new Request(`${origin}/classroom/api/guide/python-loop-accumulator`),
      context,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toHaveProperty("answers");
    const missing = await guide(new Request(`${origin}/`), {
      params: Promise.resolve({ slug: "missing" }),
    });
    expect(missing.status).toBe(404);
    const out = await logout(request("/classroom/logout"));
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("sets HttpOnly Secure SameSite cookie only after successful login and bounds request size", async () => {
    const response = await login(
      request(
        "/classroom/session",
        new URLSearchParams({ password }).toString(),
      ),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${origin}/classroom`);
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(response.headers.get("set-cookie")).toMatch(/Secure/);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=strict/i);
    expect(response.headers.get("set-cookie")).toMatch(/Path=\/classroom/);
    expect(
      (await login(request("/classroom/session", "x".repeat(2049)))).status,
    ).toBe(413);
    const bad = await login(request("/classroom/session", "password=wrong"));
    expect(bad.headers.get("set-cookie")).toBeNull();
    expect(bad.headers.get("location")).toContain("error=credentials");
  });
  it("bounds concurrent password-check memory and releases capacity afterwards", async () => {
    const first = verifyPassword(password);
    const second = verifyPassword(password);
    await expect(verifyPassword(password)).rejects.toBeInstanceOf(
      PasswordCheckBusy,
    );
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(await verifyPassword(password)).toBe(true);
  });
  it("caps local attempts without treating the cap as a shared service", () => {
    const now = Date.now() + 120000;
    for (let i = 0; i < 10; i++) expect(allowLoginAttempt(now)).toBe(true);
    expect(allowLoginAttempt(now)).toBe(false);
    expect(allowLoginAttempt(now + 60000)).toBe(true);
  });
});

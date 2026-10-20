import "server-only";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export const SESSION_COOKIE = "stackspeak_teacher";
export const SESSION_SECONDS = 60 * 60 * 8;
let passwordChecks = 0;
export class PasswordCheckBusy extends Error {}

export function authConfig() {
  const hash = process.env.CLASSROOM_PASSWORD_HASH;
  const secret = process.env.CLASSROOM_SESSION_SECRET;
  // Preview branch URL is supplied by Vercel, never by request/forwarded headers.
  // Use the stable branch URL with Standard Deployment Protection. Production
  // continues to require an explicitly configured origin.
  const branchHost = process.env.VERCEL_BRANCH_URL;
  const previewOrigin =
    process.env.VERCEL === "1" &&
    process.env.VERCEL_ENV === "preview" &&
    branchHost &&
    /^[a-z0-9-]+\.vercel\.app$/.test(branchHost)
      ? `https://${branchHost}`
      : undefined;
  const origin = process.env.CLASSROOM_ORIGIN || previewOrigin;
  if (
    !hash ||
    !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash) ||
    !secret ||
    secret.length < 64 ||
    !origin
  )
    return null;
  try {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          !process.env.VERCEL &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        ))
    )
      return null;
    return { hash, secret, origin, secure: url.protocol === "https:" };
  } catch {
    return null;
  }
}

export async function verifyPassword(password: string) {
  const config = authConfig();
  if (!config || password.length < 1 || password.length > 256) return false;
  // Bound concurrent scrypt memory per instance. This is not shared throttling.
  if (passwordChecks >= 2) throw new PasswordCheckBusy();
  passwordChecks++;
  const [salt, expected] = config.hash.split(":");
  try {
    const actual = await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password,
        salt,
        64,
        { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 },
        (error, result) => (error ? reject(error) : resolve(result)),
      );
    });
    return timingSafeEqual(actual, Buffer.from(expected, "hex"));
  } finally {
    passwordChecks--;
  }
}

function signature(payload: string) {
  const config = authConfig();
  if (!config) return null;
  return createHmac("sha256", config.secret)
    .update(`${config.origin}:${config.hash}:${payload}`)
    .digest("hex");
}

export function createSession(now = Date.now()) {
  const payload = `${Math.floor(now / 1000)}.${randomBytes(24).toString("hex")}`;
  const mac = signature(payload);
  if (!mac) throw new Error("Teacher authentication is not configured");
  return `${payload}.${mac}`;
}

export function validSession(value: string | undefined, now = Date.now()) {
  if (!value || !/^\d{10}\.[a-f0-9]{48}\.[a-f0-9]{64}$/.test(value))
    return false;
  const [issued, nonce, mac] = value.split(".");
  const age = Math.floor(now / 1000) - Number(issued);
  if (age < 0 || age >= SESSION_SECONDS) return false;
  const expected = signature(`${issued}.${nonce}`);
  return (
    !!expected &&
    timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(mac, "hex"))
  );
}

export async function isTeacher() {
  await connection();
  return validSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireTeacher() {
  if (!(await isTeacher())) redirect("/classroom/login");
}

/** No proxy/header-derived origin trust. Fail closed when not configured. */
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === authConfig()?.origin;
}

// Local defense in depth only. A public deployment needs shared/platform
// brute-force protection; this counter is deliberately NOT described as distributed.
let attempts = { window: 0, count: 0 };
export function allowLoginAttempt(now = Date.now()) {
  if (now - attempts.window >= 60_000) attempts = { window: now, count: 0 };
  return ++attempts.count <= 10;
}

import { NextResponse } from "next/server";
import {
  allowLoginAttempt,
  authConfig,
  createSession,
  sameOrigin,
  SESSION_COOKIE,
  SESSION_SECONDS,
  verifyPassword,
  PasswordCheckBusy,
} from "@/lib/classroom/auth";

export async function POST(request: Request) {
  const config = authConfig();
  if (!config)
    return new Response("Teacher access is not configured.", { status: 503 });
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  if (!allowLoginAttempt())
    return new Response("Too many attempts. Try again in a minute.", {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  if (
    !request.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
  )
    return new Response("Unsupported form", { status: 415 });
  // Bound the body even for chunked requests, rather than trusting Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return new Response("Missing form", { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 2048) {
      await reader.cancel();
      return new Response("Form too large", { status: 413 });
    }
    chunks.push(value);
  }
  const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  let verified = false;
  try {
    verified = await verifyPassword(form.get("password") ?? "");
  } catch (error) {
    return new Response("Sign in is temporarily unavailable. Please retry.", {
      status: error instanceof PasswordCheckBusy ? 429 : 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "5" },
    });
  }
  if (!verified) {
    return NextResponse.redirect(
      new URL("/classroom/login?error=credentials", config.origin),
      303,
    );
  }
  const response = NextResponse.redirect(
    new URL("/classroom", config.origin),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(SESSION_COOKIE, createSession(), {
    httpOnly: true,
    secure: config.secure,
    sameSite: "strict",
    path: "/classroom",
    maxAge: SESSION_SECONDS,
  });
  return response;
}

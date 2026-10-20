import { NextResponse } from "next/server";
import { authConfig, sameOrigin, SESSION_COOKIE } from "@/lib/classroom/auth";
export async function POST(request: Request) {
  const config = authConfig();
  if (!config || !sameOrigin(request))
    return new Response("Forbidden", { status: 403 });
  const response = NextResponse.redirect(
    new URL("/classroom/login", config.origin),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: config.secure,
    sameSite: "strict",
    path: "/classroom",
    maxAge: 0,
  });
  return response;
}

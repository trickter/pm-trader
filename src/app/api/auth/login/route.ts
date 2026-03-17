import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = body.token as string | undefined;

  if (!token || token !== env.ADMIN_API_TOKEN) {
    console.warn("[auth] Failed login attempt");
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}

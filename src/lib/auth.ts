import "server-only";

import { cookies, headers } from "next/headers";

import { env } from "@/lib/env";

/**
 * Verify the admin token from the request.
 *
 * For server actions (called from the browser), accept any of:
 * - `admin_token` cookie from the login route
 * - `x-admin-token` header propagated by middleware
 * - `Authorization: Bearer <token>`
 *
 * Returns `true` when valid; `false` otherwise.
 */
export async function verifyAdminToken(): Promise<boolean> {
  const hdrs = await headers();
  const cookieStore = await cookies();
  const token =
    cookieStore.get("admin_token")?.value ??
    hdrs.get("x-admin-token") ??
    extractBearer(hdrs.get("authorization"));

  if (!token || token !== env.ADMIN_API_TOKEN) {
    console.warn(
      `[auth] Unauthorized request – missing or invalid admin token`,
    );
    return false;
  }
  return true;
}

/**
 * Verify admin token from any supported request source for route handlers.
 */
export function verifyBearerToken(request: Request): boolean {
  const token =
    extractCookie(request.headers.get("cookie"), "admin_token") ??
    request.headers.get("x-admin-token") ??
    extractBearer(request.headers.get("authorization"));

  if (!token || token !== env.ADMIN_API_TOKEN) {
    console.warn(
      `[auth] Unauthorized API request – missing or invalid bearer token`,
    );
    return false;
  }
  return true;
}

function extractBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  return null;
}

function extractCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;

  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return rawValue.join("=") || null;
    }
  }

  return null;
}

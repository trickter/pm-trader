import "server-only";

import { headers } from "next/headers";

import { env } from "@/lib/env";

/**
 * Verify the admin token from the request.
 *
 * For server actions (called from the browser), the token is expected in the
 * `x-admin-token` header.  For API route handlers, use `verifyBearerToken`
 * which checks the standard `Authorization: Bearer <token>` header.
 *
 * Returns `true` when valid; `false` otherwise.
 */
export async function verifyAdminToken(): Promise<boolean> {
  const hdrs = await headers();
  const token =
    hdrs.get("x-admin-token") ?? extractBearer(hdrs.get("authorization"));

  if (!token || token !== env.ADMIN_API_TOKEN) {
    console.warn(
      `[auth] Unauthorized request – missing or invalid admin token`,
    );
    return false;
  }
  return true;
}

/**
 * Verify Bearer token from the Authorization header (for route handlers).
 */
export function verifyBearerToken(request: Request): boolean {
  const auth = request.headers.get("authorization");
  const token = extractBearer(auth);

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

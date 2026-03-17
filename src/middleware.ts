import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware that propagates the `admin_token` cookie into the
 * `x-admin-token` request header so that server actions (which read
 * headers via next/headers) can verify the caller's identity.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

  if (token) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-admin-token", token);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and Next.js internals.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

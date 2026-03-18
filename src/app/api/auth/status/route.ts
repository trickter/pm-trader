import { NextResponse } from "next/server";

import { verifyBearerToken } from "@/lib/auth";

export async function GET(request: Request) {
  return NextResponse.json(
    {
      authenticated: verifyBearerToken(request),
    },
    { status: 200 },
  );
}

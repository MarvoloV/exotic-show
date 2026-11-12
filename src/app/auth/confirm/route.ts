import { NextRequest, NextResponse } from "next/server";

// Retired Magic Link endpoint: old codes, token hashes and recovery links must
// never establish a session. Password login writes cookies through its Action.
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

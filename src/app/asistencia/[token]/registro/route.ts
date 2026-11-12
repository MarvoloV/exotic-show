import { recordAttendance } from "@/lib/dal/attendance";
import { isAttendanceToken, safeAttendanceResult } from "@/lib/attendance/result";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const invalid = { outcome: "invalid", full_name: null, attended_at: null };
const error = { outcome: "error" };

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  // Next may normalize request.url's hostname to localhost. Host retains the
  // browser-facing authority (including port); never use forwarded hosts or CORS.
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try {
    const parsed = new URL(origin ?? "");
    sameOrigin = origin === parsed.origin && parsed.protocol === url.protocol && parsed.host === host;
  } catch {
    // Opaque and malformed origins never qualify as same-origin.
  }
  const site = request.headers.get("sec-fetch-site");
  const sameContext = site === "same-origin" || site === "same-site";
  // Some mobile browsers omit Origin. Only its absence permits a metadata
  // fallback; a present Origin must still match exactly, without contradiction.
  const trustedOrigin = origin === null ? sameContext : sameOrigin;
  if (!trustedOrigin || (site !== null && !sameContext)) {
    return Response.json(error, { status: 403, headers });
  }
  try {
    const { token } = await params;
    if (!isAttendanceToken(token)) return Response.json(invalid, { status: 404, headers });
    const result = safeAttendanceResult(await recordAttendance(token));
    if (result) return Response.json(result, { status: result.outcome === "invalid" ? 404 : 200, headers });
  } catch {
    // Deliberately never log token-bearing requests or provider failures.
  }
  return Response.json(error, { status: 503, headers });
}

// Explicit private, non-mutating rejections also cover HEAD and preflight.
function methodNotAllowed() {
  return new Response(null, { status: 405, headers: { ...headers, Allow: "POST" } });
}
export const GET = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

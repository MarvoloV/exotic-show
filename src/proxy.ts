import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import { getAdministrator } from "@/lib/supabase/administrator";
import type { Database } from "@/types/database";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Copy refreshed cookies onto redirects as well as successful responses.
  function redirect(status?: string) {
    const destination = new URL("/login", request.url);
    if (status) destination.searchParams.set("status", status);
    const redirected = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  }

  try {
    const { url, key } = getSupabaseEnv();
    const supabase = createServerClient<Database>(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { user, approved } = await getAdministrator(supabase);
    if (!user) response = redirect();
    else if (!approved) response = redirect("unauthorized");
  } catch {
    response = redirect("unavailable");
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/admin/:path*"] };

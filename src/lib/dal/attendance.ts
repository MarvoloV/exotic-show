import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, parseSupabaseSecretKey } from "@/lib/env";
import type { AttendanceResult, Database } from "@/types/database";

// Not a Server Action: the future POST entry point must explicitly call this DAL.
// Never export the privileged client or use it for administrative data access.
export async function recordAttendance(token: unknown): Promise<AttendanceResult> {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    return { outcome: "invalid", full_name: null, attended_at: null };
  }

  try {
    const { url } = getSupabaseEnv();
    const key = parseSupabaseSecretKey(process.env.SUPABASE_SECRET_KEY);

    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.rpc("record_attendance", { attendance_token: token });
    if (error || !data || data.length !== 1) throw new Error("Invalid attendance response");

    const { outcome, full_name, attended_at } = data[0];
    if (outcome === "invalid" && full_name === null && attended_at === null) {
      return { outcome, full_name: null, attended_at: null };
    }
    if (
      (outcome === "recorded" || outcome === "already_recorded") &&
      typeof full_name === "string" && full_name.trim().length > 0 &&
      typeof attended_at === "string" && Number.isFinite(Date.parse(attended_at))
    ) {
      return { outcome, full_name, attended_at };
    }
    throw new Error("Invalid attendance response");
  } catch {
    // Do not serialize provider errors, token-bearing request URLs or credentials.
    throw new Error("No se pudo registrar la asistencia.");
  }
}

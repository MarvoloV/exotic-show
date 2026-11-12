import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function getAdministrator(supabase: SupabaseClient<Database>) {
  // getUser verifies identity with Auth; cookie session contents are not proof.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, approved: false };

  const membership = await supabase
    .from("approved_administrators")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return { user, approved: !membership.error && membership.data?.user_id === user.id };
}

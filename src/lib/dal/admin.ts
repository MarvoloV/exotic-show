import "server-only";

import { getAdministrator } from "@/lib/supabase/administrator";
import { createClient } from "@/lib/supabase/server";

// Every administrative server entry point must call this, even behind the proxy.
// The returned client keeps the user's JWT/RLS; it never bypasses authorization.
export async function requireAdmin() {
  try {
    const supabase = await createClient();
    const { user, approved } = await getAdministrator(supabase);
    if (user && approved) return { supabase, user };
  } catch {
    // Configuration, transport and provider errors must also fail closed.
  }
  throw new Error("Acceso administrativo no autorizado.");
}

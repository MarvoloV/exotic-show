"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/dal/admin";

export type SignOutState = { status: "idle" | "error"; message: string };

export async function signOutAction(): Promise<SignOutState> {
  const failure: SignOutState = {
    status: "error",
    message: "No se pudo cerrar sesión. Inténtalo de nuevo.",
  };

  try {
    // Actions can be called directly. Reuse the approved, per-request SSR client
    // so Supabase expires its session cookies through the existing adapter.
    const { supabase } = await requireAdmin();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return failure;
  } catch {
    return failure;
  }

  // Never accept a caller-provided destination or swallow Next's redirect.
  redirect("/login");
}

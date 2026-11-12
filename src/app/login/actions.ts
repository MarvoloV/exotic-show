"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "error"; message: string };

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const failure: LoginState = {
    status: "error",
    message: "No se pudo iniciar sesión. Revisa tus credenciales o contacta al administrador.",
  };
  const value = formData.get("email");
  const email = typeof value === "string" ? value.trim() : "";
  const password = formData.get("password");
  // Never trim or otherwise normalize a password: spaces may be intentional.
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || typeof password !== "string" || password.length === 0) {
    return failure;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // Do not reveal account existence, confirmation status or provider details.
    if (error || !data.user || !data.session) return failure;
  } catch {
    return failure;
  }

  // Keep Next's redirect outside the catch. The admin boundaries independently
  // verify identity and approval; a successful login alone grants no permissions.
  redirect("/admin");
}

"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: LoginState = { status: "idle", message: "" };

export function LoginForm({ disabled = false }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  return (
    <form action={action} className="mt-6 space-y-5" aria-busy={pending}>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-semibold">Correo electrónico</label>
        <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" placeholder="nombre@organizacion.com" maxLength={254} required disabled={disabled || pending} aria-describedby="email-help login-status" />
        <p id="email-help" className="text-sm text-muted-foreground">Usa el correo que tu organización habilitó para administrar el evento.</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-semibold">Contraseña</label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required disabled={disabled || pending} aria-describedby="login-status" />
      </div>
      <Button type="submit" className="w-full" disabled={disabled || pending}>
        {pending ? "Ingresando…" : "Iniciar sesión"}
      </Button>
      <p id="login-status" role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-destructive" : "text-sm leading-relaxed text-primary"}>
        {state.message}
      </p>
    </form>
  );
}

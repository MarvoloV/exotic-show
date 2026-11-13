"use client";

import { useActionState, useState } from "react";
import { signIn, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: LoginState = { status: "idle", message: "" };

export function LoginForm({ disabled = false, attendanceToken }: { disabled?: boolean; attendanceToken?: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  const [visible, setVisible] = useState(false);
  return (
    <form action={action} className="login-form" aria-busy={pending}>
      {attendanceToken && <input type="hidden" name="attendance_token" value={attendanceToken} />}
      <div className="login-field">
        <label htmlFor="email">Correo electrónico <span>Requerido</span></label>
        <div className="login-input-wrap"><span className="login-input-icon" aria-hidden="true">@</span>
          <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" placeholder="nombre@organizacion.com" maxLength={254} required disabled={disabled || pending} aria-describedby="email-help login-status" />
        </div>
        <p id="email-help" className="login-help">Usa el correo que tu organización habilitó para administrar el evento.</p>
      </div>
      <div className="login-field">
        <label htmlFor="password">Contraseña <span>Credencial</span></label>
        <div className="login-input-wrap"><span className="login-input-icon" aria-hidden="true">◇</span>
          <Input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="••••••••••••" required disabled={disabled || pending} aria-describedby="login-status" />
          <button className="login-visibility" type="button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} disabled={disabled || pending} onClick={() => setVisible((value) => !value)}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="M3 3l18 18"/>}</svg>
          </button>
        </div>
      </div>
      <Button type="submit" className="login-submit" disabled={disabled || pending}>{pending ? "Ingresando…" : "Iniciar sesión"}</Button>
      <p id="login-status" role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "login-feedback login-error" : "login-feedback"}>{state.message}</p>
    </form>
  );
}

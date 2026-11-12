"use client";

import { useActionState } from "react";
import { signOutAction, type SignOutState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

const initialState: SignOutState = { status: "idle", message: "" };

export function SignOutForm() {
  const [state, action, pending] = useActionState(signOutAction, initialState);

  return (
    <form action={action} aria-busy={pending} className="space-y-2">
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Cerrando sesión…" : "Cerrar sesión"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}

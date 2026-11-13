"use client";

import { useActionState, useId } from "react";
import { resetAttendanceAction } from "@/app/admin/participants/actions";
import { Button } from "@/components/ui/button";
import type { ParticipantActionState } from "@/lib/participants/validation";
import type { ParticipantListRow } from "@/types/database";

const initial: ParticipantActionState = { status: "idle", message: "" };

export function ParticipantResetForm({ participant, onSuccess }: { participant: ParticipantListRow; onSuccess: () => void }) {
  const prefix = useId();
  const [state, action, pending] = useActionState(async (previous: ParticipantActionState, form: FormData) => {
    const result = await resetAttendanceAction(previous, form);
    if (result.status === "success") onSuccess();
    return result;
  }, initial);
  return <form action={action} aria-busy={pending} aria-describedby={`${prefix}-warning`} className="space-y-4 p-4">
    <input type="hidden" name="id" value={participant.id} />
    <input type="hidden" name="attended_at" value={participant.attended_at ?? ""} />
    <p id={`${prefix}-warning`} className="text-sm">La fecha de ingreso anterior se borrará. Un nuevo escaneo registrará una nueva fecha.</p>
    <Button type="submit" variant="outline" disabled={pending}>{pending ? "Restableciendo…" : "Volver a pendiente"}</Button>
    <p role={state.status === "error" ? "alert" : "status"} className="text-sm text-destructive">{state.message}</p>
  </form>;
}

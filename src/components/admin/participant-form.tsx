"use client";

import { useActionState, useId, useRef, useState } from "react";
import { createParticipantAction, deleteParticipantAction, updateParticipantAction } from "@/app/admin/participants/actions";
import { validateParticipant, type ParticipantActionState, type ParticipantFieldErrors } from "@/lib/participants/validation";
import type { ParticipantListRow } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: ParticipantActionState = { status: "idle", message: "" };

function ActionMessage({ state, id }: { state: ParticipantActionState; id: string }) {
  return <p id={id} role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>{state.message}</p>;
}

export function ParticipantForm({ participant }: { participant?: ParticipantListRow }) {
  const prefix = useId();
  const [name, setName] = useState(participant?.full_name ?? "");
  const [amount, setAmount] = useState(participant?.paid_amount.toFixed(2) ?? "0");
  const [clientErrors, setClientErrors] = useState<ParticipantFieldErrors | null>(null);
  const [state, action, pending] = useActionState(async (previous: ParticipantActionState, form: FormData) => {
    const result = await (participant ? updateParticipantAction : createParticipantAction)(previous, form);
    setClientErrors(null);
    if (result.status === "success" && !participant) { setName(""); setAmount("0"); }
    return result;
  }, initial);
  const errors = clientErrors ?? state.errors ?? {};
  return <form action={action} noValidate aria-busy={pending} className="space-y-4 p-4" onSubmit={(event) => {
    const result = validateParticipant({ full_name: name, paid_amount: amount });
    if (!result.ok) { event.preventDefault(); setClientErrors(result.errors); }
    else setClientErrors(null);
  }}>
    {participant && <input type="hidden" name="id" value={participant.id} />}
    <p className="text-sm text-muted-foreground">{participant ? `Editar ${participant.code}. El código, QR y asistencia se conservan.` : "El código y el token se generan automáticamente. La asistencia inicial es PENDIENTE."}</p>
    <div>
      <label htmlFor={`${prefix}-name`} className="text-sm font-medium">Nombres y apellidos</label>
      <Input id={`${prefix}-name`} name="full_name" value={name} onChange={(event) => { setName(event.target.value); setClientErrors({}); }} required disabled={pending}
        aria-invalid={Boolean(errors.full_name)} aria-describedby={`${prefix}-name-help ${prefix}-name-error`} className="mt-2" />
      <p id={`${prefix}-name-help`} className="mt-1 text-xs text-muted-foreground">1–200 caracteres. Se eliminan los espacios al inicio y al final.</p>
      <p id={`${prefix}-name-error`} role="alert" className="text-sm text-destructive">{errors.full_name}</p>
    </div>
    <div>
      <label htmlFor={`${prefix}-amount`} className="text-sm font-medium">Monto pagado</label>
      <Input id={`${prefix}-amount`} name="paid_amount" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setClientErrors({}); }} required disabled={pending}
        aria-invalid={Boolean(errors.paid_amount)} aria-describedby={`${prefix}-amount-help ${prefix}-amount-error`} className="mt-2" />
      <p id={`${prefix}-amount-help`} className="mt-1 text-xs text-muted-foreground">De 0 a 9999999999.99; hasta dos decimales, separados por punto. Sin moneda asignada.</p>
      <p id={`${prefix}-amount-error`} role="alert" className="text-sm text-destructive">{errors.paid_amount}</p>
    </div>
    <Button type="submit" disabled={pending}>{pending ? "Guardando…" : participant ? "Guardar cambios" : "Registrar participante"}</Button>
    <ActionMessage state={state} id={`${prefix}-status`} />
  </form>;
}

export function DeleteParticipantForm({ participant }: { participant: Pick<ParticipantListRow, "id" | "code" | "full_name"> }) {
  const prefix = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const [state, action, pending] = useActionState(deleteParticipantAction, initial);
  return <details ref={details} className="rounded-lg border border-border">
    <summary className="cursor-pointer rounded-lg p-3 text-sm font-semibold text-destructive focus-visible:outline-2 focus-visible:outline-ring">Eliminar<span className="sr-only"> {participant.code}: {participant.full_name}</span></summary>
    <form action={action} aria-busy={pending} className="space-y-4 p-4" role="group" aria-labelledby={`${prefix}-title`} aria-describedby={`${prefix}-warning`}>
      <input type="hidden" name="id" value={participant.id} />
      <h3 id={`${prefix}-title`} className="font-semibold">¿Eliminar a {participant.full_name} ({participant.code})?</h3>
      <p id={`${prefix}-warning`} className="text-sm">Esta acción eliminará el participante e invalidará su QR. No se puede deshacer.</p>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending} className="bg-destructive text-white hover:bg-destructive/90">{pending ? "Eliminando…" : "Confirmar eliminación"}</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => {
          if (details.current) { details.current.open = false; details.current.querySelector("summary")?.focus(); }
        }}>Cancelar</Button>
      </div>
      <ActionMessage state={state} id={`${prefix}-status`} />
    </form>
  </details>;
}

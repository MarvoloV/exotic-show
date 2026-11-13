"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { ParticipantForm } from "@/components/admin/participant-form";
import { Button } from "@/components/ui/button";
import type { ParticipantListRow } from "@/types/database";

export function ParticipantEditDialog({ participant }: { participant: ParticipantListRow }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const [session, setSession] = useState(0);
  const prefix = useId();

  useEffect(() => {
    if (session) dialog.current?.querySelector<HTMLInputElement>('input[name="full_name"]')?.focus();
  }, [session]);

  return <>
    <Button ref={trigger} type="button" variant="outline" className="min-h-11 min-w-11 p-0" title={`Editar ${participant.code}: ${participant.full_name}`} aria-haspopup="dialog" onClick={() => {
      setSession(++generation.current);
      dialog.current?.showModal();
    }}><Pencil aria-hidden="true" /><span className="sr-only">Editar {participant.code}: {participant.full_name}</span></Button>
    <dialog ref={dialog} className="participants-registration-dialog" aria-labelledby={`${prefix}-title`} onClose={() => {
      generation.current++;
      setSession(0);
      trigger.current?.focus();
    }}>
      <div className="participants-registration-header">
        <h2 id={`${prefix}-title`}>Editar participante</h2>
        <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>Cerrar edición</Button>
      </div>
      {session !== 0 && <ParticipantForm key={session} participant={participant} onSuccess={() => {
        if (generation.current === session) dialog.current?.close();
      }} />}
    </dialog>
  </>;
}

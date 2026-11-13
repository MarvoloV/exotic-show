"use client";

import { useId, useRef } from "react";
import { ParticipantForm } from "@/components/admin/participant-form";
import { Button } from "@/components/ui/button";

export function ParticipantRegistrationDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const prefix = useId();

  return <>
    <Button ref={trigger} type="button" className="participants-registration-trigger" aria-haspopup="dialog" onClick={() => {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLInputElement>('input[name="full_name"]')?.focus();
    }}>+ Registrar participante</Button>
    <dialog ref={dialog} className="participants-registration-dialog" aria-labelledby={`${prefix}-title`} onClose={() => trigger.current?.focus()}>
      <div className="participants-registration-header">
        <h2 id={`${prefix}-title`}>Registrar participante</h2>
        <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>Cerrar registro</Button>
      </div>
      <ParticipantForm />
    </dialog>
  </>;
}

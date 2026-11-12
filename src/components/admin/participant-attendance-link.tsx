"use client";

import { useId, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { ParticipantListRow } from "@/types/database";

export function ParticipantAttendanceLink({ participant }: { participant: Pick<ParticipantListRow, "code" | "attendance_url"> }) {
  const prefix = useId();
  const [state, setState] = useState<"idle" | "copying" | "success" | "error">("idle");
  const feedback = state === "copying" ? "Copiando…" : state === "success" ? "Enlace copiado." : state === "error"
    ? "No se pudo copiar el enlace. Selecciónalo y cópialo manualmente." : "";

  async function copy() {
    setState("copying");
    try {
      // Explicit clipboard write only: never navigate, fetch, or log this bearer URL.
      await navigator.clipboard.writeText(participant.attendance_url);
      setState("success");
    } catch {
      setState("error");
    }
  }

  return <div className="w-64 min-w-0 space-y-2 md:w-80">
    <label htmlFor={`${prefix}-link`} className="sr-only">Enlace de asistencia de {participant.code}</label>
    <input id={`${prefix}-link`} readOnly value={participant.attendance_url} aria-describedby={`${prefix}-feedback`}
      className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
    <button type="button" className={buttonVariants({ variant: "outline" })} onClick={copy} disabled={state === "copying"}
      aria-describedby={`${prefix}-feedback`}>
      Copiar enlace<span className="sr-only"> de {participant.code}</span>
    </button>
    <p id={`${prefix}-feedback`} role="status" aria-live="polite" aria-atomic="true" className="text-sm break-words text-muted-foreground">{feedback}</p>
  </div>;
}

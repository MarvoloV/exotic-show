"use client";

import { useId, useRef, useState } from "react";
import { getParticipantQrAction } from "@/app/admin/participants/qr-actions";
import { QR_ERROR, type ParticipantQrPreview } from "@/lib/participants/qr";
import type { ParticipantListRow } from "@/types/database";
import { buttonVariants } from "@/components/ui/button";

export function ParticipantQr({ participant }: { participant: Pick<ParticipantListRow, "id" | "code" | "full_name"> }) {
  const prefix = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const [preview, setPreview] = useState<ParticipantQrPreview | null>(null);
  const [loading, setLoading] = useState(false);

  async function open() {
    const current = ++generation.current;
    setPreview(null);
    setLoading(true);
    dialog.current?.showModal();
    try {
      const result = await getParticipantQrAction(participant.id);
      if (current === generation.current) setPreview(result);
    } catch {
      if (current === generation.current) setPreview({ ok: false, message: QR_ERROR });
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  function clear() {
    generation.current++;
    setPreview(null);
    setLoading(false);
  }

  return <>
    <button type="button" className={buttonVariants({ variant: "outline" })} onClick={open} aria-haspopup="dialog">
      Ver QR<span className="sr-only"> de {participant.code}: {participant.full_name}</span>
    </button>
    <dialog ref={dialog} aria-labelledby={`${prefix}-title`} aria-describedby={`${prefix}-warning`} onClose={clear}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-xl backdrop:bg-black/50">
      <div className="flex items-start justify-between gap-4">
        <h2 id={`${prefix}-title`} className="text-xl font-semibold">QR de {participant.code}: {participant.full_name}</h2>
        <button type="button" className={buttonVariants({ variant: "outline" })} onClick={() => dialog.current?.close()} autoFocus>Cerrar</button>
      </div>
      <p id={`${prefix}-warning`} className="my-4 text-sm text-muted-foreground">Abrir este enlace registra la asistencia. Es personal: puede compartirse. No lo abras para probar el QR. Ver o descargar esta imagen no registra asistencia.</p>
      <div aria-busy={loading} className="space-y-4">
        {loading && <p role="status">Cargando QR…</p>}
        {preview && !preview.ok && <div className="space-y-3"><p role="alert">{QR_ERROR}</p>
          <button type="button" className={buttonVariants({ variant: "outline" })} onClick={open}>Reintentar</button></div>}
        {preview?.ok && <>
          {/* Local data URI, never an attendance URL or an image-optimization request. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.image} alt={`Código QR de ${participant.code}`} width={320} height={320} className="mx-auto h-auto max-w-full" />
          <div><label htmlFor={`${prefix}-link`} className="text-sm font-medium">Enlace personal (solo lectura)</label>
            <input id={`${prefix}-link`} readOnly value={preview.url} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
          </div>
          <a href={`/admin/participants/${participant.id}/qr`} download className={buttonVariants()}>Descargar PNG</a>
        </>}
      </div>
    </dialog>
  </>;
}

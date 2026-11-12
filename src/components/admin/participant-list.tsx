import Link from "next/link";
import { formatAttendance } from "@/lib/dates";
import { formatAmount } from "@/lib/participants/format";
import { PAGE_SIZE, participantHref, type ParticipantQuery } from "@/lib/participants/query";
import type { ParticipantListRow } from "@/types/database";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { DeleteParticipantForm, ParticipantForm } from "@/components/admin/participant-form";
import { ParticipantQr } from "@/components/admin/participant-qr";

export function ParticipantList({ rows, total, query }: { rows: ParticipantListRow[]; total: number; query: ParticipantQuery }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(query.q) || query.state !== "all";
  if (total === 0) return <div role="status" className="space-y-3 rounded-2xl border border-border bg-card p-8 text-center">
    <h2 className="text-xl font-semibold">{filtered ? "No se encontraron coincidencias" : "Aún no hay participantes"}</h2>
    <p className="text-muted-foreground">{filtered ? "Prueba con otro nombre, código o estado." : "Los participantes registrados aparecerán aquí."}</p>
    {filtered && <Link href="/admin/participants" className={buttonVariants({ variant: "outline" })}>Limpiar filtros</Link>}
  </div>;
  return <div className="space-y-4">
    <p id="table-hint" className="text-sm text-muted-foreground">Fechas en America/Lima. En pantallas pequeñas, desplaza la tabla horizontalmente.</p>
    <div role="region" aria-label="Listado de participantes" aria-describedby="table-hint" tabIndex={0}
      className="overflow-x-auto rounded-xl border border-border bg-card focus-visible:outline-2 focus-visible:outline-ring">
      <Table className="min-w-[700px]">
        <caption className="sr-only">Participantes: código, nombre, estado, ingreso, monto pagado, QR y acciones de edición o eliminación.</caption>
        <thead className="bg-muted"><tr>
          {["Código", "Nombres y apellidos", "Estado", "Fecha de ingreso", "Pagó", "Acciones"].map((heading) => <TableHead key={heading}>{heading}</TableHead>)}
        </tr></thead>
        <tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.id} className="hover:bg-muted/50">
          <TableCell className="font-medium whitespace-nowrap">{row.code}</TableCell>
          <TableCell className="max-w-xs break-words">{row.full_name}</TableCell>
          <TableCell><span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${row.attendance_state === "ASISTIÓ" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{row.attendance_state}</span></TableCell>
          <TableCell className="whitespace-nowrap">{row.attended_at ? <time dateTime={row.attended_at}>{formatAttendance(row.attended_at)}</time> : "—"}</TableCell>
          <TableCell className="text-right tabular-nums">{formatAmount(row.paid_amount.toFixed(2))}</TableCell>
          <TableCell className="min-w-72 align-top">
            <div className="space-y-2">
              <ParticipantQr participant={{ id: row.id, code: row.code, full_name: row.full_name }} />
              <details className="rounded-lg border border-border">
                <summary className="cursor-pointer rounded-lg p-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">Editar<span className="sr-only"> {row.code}: {row.full_name}</span></summary>
                <ParticipantForm participant={row} />
              </details>
              <DeleteParticipantForm participant={row} />
            </div>
          </TableCell>
        </tr>)}</tbody>
      </Table>
    </div>
    {rows.length === 0 && <p role="status">El listado cambió durante la consulta. Actualiza los datos para ver la página actual.</p>}
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p role="status" className="text-sm text-muted-foreground">{total} participantes · Página {query.page} de {pages}</p>
      <nav aria-label="Paginación" className="flex gap-3">
        {query.page > 1 ? <Link href={participantHref(query, query.page - 1)} className={buttonVariants({ variant: "outline" })}>Anterior</Link> : <span aria-disabled="true" className={buttonVariants({ variant: "outline", className: "opacity-50" })}>Anterior</span>}
        {query.page < pages ? <Link href={participantHref(query, query.page + 1)} className={buttonVariants({ variant: "outline" })}>Siguiente</Link> : <span aria-disabled="true" className={buttonVariants({ variant: "outline", className: "opacity-50" })}>Siguiente</span>}
      </nav>
    </div>
  </div>;
}

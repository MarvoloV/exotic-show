import Link from "next/link";
import { formatAttendance } from "@/lib/dates";
import { formatAmount } from "@/lib/participants/format";
import { PAGE_SIZE, participantHref, type ParticipantQuery } from "@/lib/participants/query";
import type { ParticipantListRow } from "@/types/database";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { DeleteParticipantForm } from "@/components/admin/participant-form";
import { ParticipantEditDialog } from "@/components/admin/participant-edit-dialog";
import { ParticipantQr } from "@/components/admin/participant-qr";
import { ParticipantAttendanceLink } from "@/components/admin/participant-attendance-link";

export function ParticipantList({ rows, total, query }: { rows: ParticipantListRow[]; total: number; query: ParticipantQuery }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(query.q) || query.state !== "all";
  if (total === 0) return <div role="status" className="participants-empty">
    <h2>{filtered ? "No se encontraron coincidencias" : "Aún no hay participantes"}</h2>
    <p>{filtered ? "Prueba con otro nombre, código o estado." : "Los participantes registrados aparecerán aquí."}</p>
    {filtered && <Link href="/admin/participants" className={buttonVariants({ variant: "outline" })}>Limpiar filtros</Link>}
  </div>;
  return <div className="participants-list">
    <p id="table-hint" className="participants-help">Fechas en America/Lima. Copiar el enlace no registra asistencia; abrirlo con una cuenta administradora aprobada sí. Mantén el enlace privado.</p>
    <div role="region" aria-label="Listado de participantes" aria-describedby="table-hint" className="participants-table-region">
      <Table className="participants-table">
        <caption className="sr-only">Participantes: código, nombre, estado, ingreso, enlace QR para copiar, monto pagado, QR y acciones de edición o eliminación.</caption>
        <thead><tr>{["Código", "Nombres y apellidos", "Estado", "Fecha de ingreso", "Enlace QR", "Pagó", "Acciones"].map((heading) => <TableHead scope="col" key={heading}>{heading}</TableHead>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <TableCell className="participant-code">{row.code}</TableCell>
          <TableCell className="participant-name"><span className="participant-avatar" aria-hidden="true">{row.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><strong>{row.full_name}</strong></TableCell>
          <TableCell className="participant-state"><span className={row.attendance_state === "ASISTIÓ" ? "participant-badge attended" : "participant-badge"}>{row.attendance_state}</span></TableCell>
          <TableCell className="participant-date"><span className="participant-mobile-label">Ingreso: </span>{row.attended_at ? <time dateTime={row.attended_at}>{formatAttendance(row.attended_at)}</time> : "—"}</TableCell>
          <TableCell className="participant-link"><ParticipantAttendanceLink compact participant={{ code: row.code, attendance_url: row.attendance_url }} /></TableCell>
          <TableCell className="participant-amount"><span className="participant-mobile-label">Pagó: </span>{formatAmount(row.paid_amount.toFixed(2))}</TableCell>
          <TableCell className="participant-actions">
            <ParticipantQr participant={{ id: row.id, code: row.code, full_name: row.full_name }} />
            <details className="participant-actions-details"><summary>Acciones<span className="sr-only"> {row.code}: {row.full_name}</span></summary>
              <ParticipantEditDialog participant={row} />
              <DeleteParticipantForm participant={row} />
            </details>
          </TableCell>
        </tr>)}</tbody>
      </Table>
    </div>
    {rows.length === 0 && <p role="status" className="participants-help">El listado cambió durante la consulta. Actualiza los datos para ver la página actual.</p>}
    <div className="participants-footer">
      <p role="status">{total} participantes · Página {query.page} de {pages}</p>
      <nav aria-label="Paginación">
        {query.page > 1 ? <Link href={participantHref(query, query.page - 1)} className={buttonVariants({ variant: "outline" })}>Anterior</Link> : <span aria-disabled="true" className={buttonVariants({ variant: "outline", className: "opacity-50" })}>Anterior</span>}
        {query.page < pages ? <Link href={participantHref(query, query.page + 1)} className={buttonVariants({ variant: "outline" })}>Siguiente</Link> : <span aria-disabled="true" className={buttonVariants({ variant: "outline", className: "opacity-50" })}>Siguiente</span>}
      </nav>
    </div>
  </div>;
}

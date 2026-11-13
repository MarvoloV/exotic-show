"use client";

import Link from "next/link";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
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

const columns: ColumnDef<ParticipantListRow>[] = [
  { accessorKey: "code", header: "Código", cell: ({ row }) => row.original.code },
  { accessorKey: "full_name", header: "Nombres y apellidos", cell: ({ row }) => <><span className="participant-avatar" aria-hidden="true">{row.original.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><strong>{row.original.full_name}</strong></> },
  { accessorKey: "attendance_state", header: "Estado", cell: ({ row }) => <span className={row.original.attendance_state === "ASISTIÓ" ? "participant-badge attended" : "participant-badge"}>{row.original.attendance_state}</span> },
  { accessorKey: "attended_at", header: "Fecha de ingreso", cell: ({ row }) => <><span className="participant-mobile-label">Ingreso: </span>{row.original.attended_at ? <time dateTime={row.original.attended_at}>{formatAttendance(row.original.attended_at)}</time> : "—"}</> },
  { id: "link", header: "Enlace QR", cell: ({ row }) => <ParticipantAttendanceLink compact participant={{ code: row.original.code, attendance_url: row.original.attendance_url }} /> },
  { accessorKey: "paid_amount", header: "Pagó", cell: ({ row }) => <><span className="participant-mobile-label">Pagó: </span>{formatAmount(row.original.paid_amount.toFixed(2))}</> },
  { id: "actions", header: "Acciones", cell: ({ row: { original: row } }) => <div className="participant-actions-group"><ParticipantQr participant={{ id: row.id, code: row.code, full_name: row.full_name }} /><ParticipantEditDialog participant={row} /><DeleteParticipantForm participant={row} /></div> },
];
const cellClasses: Record<string, string> = { code: "participant-code", full_name: "participant-name", attendance_state: "participant-state", attended_at: "participant-date", link: "participant-link", paid_amount: "participant-amount", actions: "participant-actions" };

type ListProps = { rows: ParticipantListRow[]; total: number; query: ParticipantQuery };

export function ParticipantList(props: ListProps) {
  return <ParticipantTable {...props} />;
}

function ParticipantTable({ rows, total, query }: ListProps) {
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), manualSorting: true, manualPagination: true, getRowId: (row) => row.id });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(query.q) || query.state !== "all";
  const direction = query.sort === "code" && query.direction === "asc" ? "desc" : "asc";
  const sortHref = participantHref({ ...query, sort: "code", direction }, 1);
  const sortLabel = `Ordenar por código ${direction === "asc" ? "ascendente" : "descendente"}`;
  const ariaSort = query.sort === "code" ? (query.direction === "asc" ? "ascending" : "descending") : "none";
  if (total === 0) return <div role="status" className="participants-empty">
    <h2>{filtered ? "No se encontraron coincidencias" : "Aún no hay participantes"}</h2>
    <p>{filtered ? "Prueba con otro nombre, código o estado." : "Los participantes registrados aparecerán aquí."}</p>
    {filtered && <Link href="/admin/participants" className={buttonVariants({ variant: "outline" })}>Limpiar filtros</Link>}
  </div>;
  return <div className="participants-list">
    <p id="table-hint" className="participants-help">Fechas en America/Lima. Copiar el enlace no registra asistencia; abrirlo con una cuenta administradora aprobada sí. Mantén el enlace privado.</p>
    <div className="participants-mobile-sort"><Link href={sortHref} aria-label={sortLabel} className={buttonVariants({ variant: "outline" })}>Código {query.sort === "code" ? (query.direction === "asc" ? "↑" : "↓") : "↕"}</Link></div>
    <div role="region" aria-label="Listado de participantes" aria-describedby="table-hint" className="participants-table-region">
      <Table className="participants-table">
        <caption className="sr-only">Participantes: código, nombre, estado, ingreso, enlace QR para copiar, monto pagado, QR y acciones de edición o eliminación.</caption>
        <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <TableHead scope="col" key={header.id} aria-sort={header.column.id === "code" ? ariaSort : undefined}>{header.column.id === "code" ? <Link href={sortHref} aria-label={sortLabel}>Código {query.sort === "code" ? (query.direction === "asc" ? "↑" : "↓") : "↕"}</Link> : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</tr>)}</thead>
        <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className={cellClasses[cell.column.id]}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</tr>)}</tbody>
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

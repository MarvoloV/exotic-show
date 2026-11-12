import Form from "next/form";
import Link from "next/link";
import { getParticipants } from "@/lib/dal/participants";
import { SORT_OPTIONS, type SearchParams } from "@/lib/participants/query";
import { ParticipantList } from "@/components/admin/participant-list";
import { ParticipantForm } from "@/components/admin/participant-form";
import { ParticipantExport } from "@/components/admin/participant-export";
import { RefreshButton } from "@/components/admin/refresh-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const selectClass = "mt-2 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const result = await getParticipants(await searchParams);
  const { query } = result;
  return <section className="space-y-6" aria-labelledby="participants-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 id="participants-title" className="text-3xl font-bold tracking-tight">Participantes</h1>
        <p className="mt-2 text-muted-foreground">Consulta nombres, pagos y asistencia en un solo lugar.</p></div>
      <RefreshButton />
    </div>
    <details className="rounded-2xl border border-border bg-card">
      <summary className="cursor-pointer rounded-2xl p-5 font-semibold focus-visible:outline-2 focus-visible:outline-ring">Registrar participante</summary>
      <div className="max-w-2xl"><ParticipantForm /></div>
    </details>
    <p className="text-sm text-muted-foreground">Registra participantes o usa Editar / Eliminar en cada fila. Al guardar, se actualizan el listado y el resumen sin recargar la página; tus filtros y orden se conservan.</p>
    <Form action="/admin/participants" key={JSON.stringify(query)} className="grid items-end gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Buscar y filtrar participantes">
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor="participant-search" className="text-sm font-medium">Nombre o código</label>
        <Input id="participant-search" name="q" type="search" defaultValue={query.q} maxLength={200} placeholder="Ej. Ana Pérez o EX001" className="mt-2" />
      </div>
      <div><label htmlFor="participant-state" className="text-sm font-medium">Estado</label>
        <select id="participant-state" name="state" defaultValue={query.state} className={selectClass}>
          <option value="all">Todos los estados</option><option value="pending">PENDIENTE</option><option value="attended">ASISTIÓ</option>
        </select>
      </div>
      <div><label htmlFor="participant-sort" className="text-sm font-medium">Ordenar por</label>
        <select id="participant-sort" name="sort" defaultValue={query.sort} className={selectClass}>
          {Object.entries(SORT_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div><label htmlFor="participant-direction" className="text-sm font-medium">Dirección</label>
        <select id="participant-direction" name="direction" defaultValue={query.direction} className={selectClass}>
          <option value="desc">Descendente</option><option value="asc">Ascendente</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">Busca texto literal, sin comodines. Se muestran 20 participantes por página.</p>
      <div className="flex flex-wrap gap-3 sm:col-span-2 lg:justify-end">
        <Button type="submit">Aplicar filtros</Button>
        <Link href="/admin/participants" className={buttonVariants({ variant: "outline" })}>Limpiar</Link>
      </div>
    </Form>
    <ParticipantExport query={query} />
    <ParticipantList {...result} />
  </section>;
}

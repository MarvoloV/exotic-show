import Form from "next/form";
import Link from "next/link";
import { getParticipants } from "@/lib/dal/participants";
import { participantHref, type ParticipantQuery, type SearchParams } from "@/lib/participants/query";
import { ParticipantList } from "@/components/admin/participant-list";
import { ParticipantRegistrationDialog } from "@/components/admin/participant-registration-dialog";
import { ParticipantExport } from "@/components/admin/participant-export";
import { RefreshButton } from "@/components/admin/refresh-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const result = await getParticipants(await searchParams);
  const { query } = result;
  const states: { state: ParticipantQuery["state"]; label: string }[] = [
    { state: "all", label: "Todos" }, { state: "attended", label: "Asistió" }, { state: "pending", label: "Pendiente" },
  ];
  return <section className="participants-screen" aria-labelledby="participants-title">
    <div className="participants-top">
      <div><p className="participants-eyebrow">Administración</p><h1 id="participants-title">Control de Participantes</h1>
        <p>Consulta nombres, pagos y asistencia en un solo lugar.</p></div>
      <RefreshButton />
    </div>
    <ParticipantRegistrationDialog />
    <p className="participants-help">Registra participantes o usa Editar / Eliminar en cada fila. Al guardar, se actualizan el listado y el resumen sin recargar la página; tus filtros y orden se conservan.</p>
    <div className="participants-panel">
      <div className="participants-panel-header">
        <div><h2>Listado de participantes</h2><p>{result.total} participantes con los filtros aplicados</p></div>
        <nav aria-label="Filtro rápido por estado" className="participants-pills">
          {states.map(({ state, label }) => <Link key={state} href={participantHref({ ...query, state }, 1)} aria-current={query.state === state ? "page" : undefined}>{label}</Link>)}
        </nav>
      </div>
      <Form action="/admin/participants" key={JSON.stringify(query)} className="participants-filter" aria-label="Buscar participantes">
        <div className="participants-search"><label htmlFor="participant-search">Nombre o código</label>
          <Input id="participant-search" name="q" type="search" defaultValue={query.q} maxLength={200} placeholder="Ej. Ana Pérez o EX001" /></div>
        <input type="hidden" name="state" value={query.state} />
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="direction" value={query.direction} />
        <div className="participants-filter-actions"><Button type="submit">Buscar</Button>
          <Link href="/admin/participants" className={buttonVariants({ variant: "outline" })}>Limpiar</Link></div>
        <p className="participants-help">Busca texto literal, sin comodines. Se muestran 20 participantes por página.</p>
      </Form>
      <details className="participants-export"><summary>Exportar CSV</summary><ParticipantExport query={query} /></details>
      <ParticipantList {...result} />
    </div>
  </section>;
}

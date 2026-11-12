import { Button } from "@/components/ui/button";
import type { ParticipantQuery } from "@/lib/participants/query";

export function ParticipantExport({ query }: { query: ParticipantQuery }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
    <p id="export-hint" className="max-w-2xl text-sm text-muted-foreground">
      Exporta todas las coincidencias con los filtros y el orden aplicados, no solo esta página.
      CSV: código, nombre, estado, ingreso en America/Lima y monto sin moneda. No incluye tokens, enlaces ni QR.
      Las celdas que podrían ser fórmulas llevan un apóstrofo de protección.
    </p>
    <form action="/admin/participants/export" method="get" aria-describedby="export-hint">
      <input type="hidden" name="q" value={query.q} />
      <input type="hidden" name="state" value={query.state} />
      <input type="hidden" name="sort" value={query.sort} />
      <input type="hidden" name="direction" value={query.direction} />
      <Button type="submit" variant="outline">Exportar CSV</Button>
    </form>
  </div>;
}

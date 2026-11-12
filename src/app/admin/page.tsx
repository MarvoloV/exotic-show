import Link from "next/link";
import { getDashboardMetrics } from "@/lib/dal/participants";
import { formatAmount } from "@/lib/participants/format";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { RefreshButton } from "@/components/admin/refresh-button";

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();
  const cards = [
    ["Participantes registrados", metrics.registered],
    ["Participantes que asistieron", metrics.attended],
    ["Participantes pendientes", metrics.pending],
    ["Total de pagos registrados", formatAmount(metrics.paid_total)],
    ["Porcentaje de asistencia", `${metrics.attendance_percentage}%`],
  ];
  return (
    <section className="space-y-6" aria-labelledby="dashboard-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 id="dashboard-title" className="text-3xl font-bold tracking-tight">Resumen general</h1>
          <p className="mt-2 text-muted-foreground">Todos los participantes, sin filtros del listado.</p></div>
        <RefreshButton />
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => <Card key={label}>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-3 break-all text-3xl font-semibold tabular-nums">{value}</dd>
        </Card>)}
      </dl>
      <Link href="/admin/participants" className={buttonVariants()}>Ver participantes</Link>
    </section>
  );
}

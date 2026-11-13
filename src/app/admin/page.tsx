import type { CSSProperties } from "react";
import Link from "next/link";
import { getDashboardMetrics } from "@/lib/dal/participants";
import { formatAmount } from "@/lib/participants/format";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { RefreshButton } from "@/components/admin/refresh-button";

function Metric({ label, value, kind }: { label: string; value: string | number; kind: string }) {
  return <div className={`dashboard-metric dashboard-metric-${kind}`}><dt>{label}</dt><dd>{value}</dd></div>;
}

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();
  const numericPercentage = Number(metrics.attendance_percentage);
  const percentage = Number.isFinite(numericPercentage) && numericPercentage >= 0 && numericPercentage <= 100
    ? metrics.attendance_percentage : "0";
  const ringStyle = { "--attendance": `${percentage}%` } as CSSProperties;
  return (
    <section className="admin-dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-brand">Asistencia QR <span>Administración</span></div>
      <div className="dashboard-heading">
        <div><p className="dashboard-eyebrow">Panel de administración</p><h1 id="dashboard-title">Resumen general</h1>
          <p>Todos los participantes, sin filtros del listado.</p></div>
        <div className="dashboard-actions"><Link href="/admin/participants" className={buttonVariants()}>+ Registrar participante</Link><div className="dashboard-refresh"><RefreshButton /></div></div>
      </div>
      <dl className="dashboard-metrics">
        <Card className="dashboard-ring-card">
          <dt>Porcentaje de asistencia</dt>
          <dd className="dashboard-ring-content"><div className="dashboard-ring" role="img" aria-label={`Porcentaje de asistencia: ${percentage}%`} style={ringStyle}><span>{percentage}%</span></div>
            <div className="dashboard-ring-copy"><span>Asistencia total</span><strong>{percentage}%</strong><p>{metrics.attended} de {metrics.registered} participantes asistieron.</p></div></dd>
        </Card>
        <Card className="dashboard-metric-group">
          <Metric label="Participantes registrados" value={metrics.registered} kind="registered" />
          <Metric label="Participantes que asistieron" value={metrics.attended} kind="attended" />
          <Metric label="Participantes pendientes" value={metrics.pending} kind="pending" />
          <Metric label="Total de pagos registrados" value={formatAmount(metrics.paid_total)} kind="paid" />
        </Card>
      </dl>
      <Card className="dashboard-participants"><div><p className="dashboard-eyebrow">Gestión de registros</p><h2>Control de participantes</h2><p>Consulta y administra los participantes registrados.</p></div><Link href="/admin/participants" className={buttonVariants({ variant: "outline" })}>Ver participantes →</Link></Card>
    </section>
  );
}

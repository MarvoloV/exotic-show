import type { Metadata } from "next";
import { AttendanceRegistration } from "@/components/attendance/attendance-registration";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/dal/admin";
import { isAttendanceToken } from "@/lib/attendance/result";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Registro de asistencia",
  referrer: "strict-origin",
  robots: { index: false, follow: false },
};

export default async function AttendancePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let authorized = false;
  try {
    await requireAdmin();
    authorized = true;
  } catch {
    // No session, approval or provider availability: fail closed.
  }
  if (!authorized) redirect(isAttendanceToken(token) ? `/login?attendance_token=${token}` : "/login");
  // GET/HEAD, server rendering and prefetch must never look up or record a participant.
  return (
    <section className="attendance-screen" aria-labelledby="attendance-title">
      <header className="attendance-header">THE EXOTIC SHOW <span>Control de asistencia</span></header>
      <div className="attendance-content">
        <div className="attendance-heading">
          <p className="attendance-eyebrow">Control en puerta · Validación de acceso</p>
          <h1 id="attendance-title">Registro de asistencia</h1>
          <p>Un administrador autorizado registra la asistencia automáticamente al abrir este enlace.</p>
        </div>
        <div className="attendance-card">
          <div className="attendance-protocol"><span aria-hidden="true">◇</span> Protocolo de asistencia · Nocturne</div>
          <AttendanceRegistration key={token} token={token} />
          <noscript><p className="attendance-noscript">Activa JavaScript para registrar tu asistencia automáticamente o pide ayuda al organizador. Sin JavaScript no se registra el ingreso.</p></noscript>
          <div className="attendance-actions"><Link href="/admin">Volver al panel <span aria-hidden="true">→</span></Link></div>
        </div>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import { AttendanceRegistration } from "@/components/attendance/attendance-registration";
import { Card } from "@/components/ui/card";
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
    <section className="mx-auto w-full min-w-0 max-w-lg space-y-6" aria-labelledby="attendance-title">
      <h1 id="attendance-title" className="text-3xl font-semibold tracking-tight">Registro de asistencia</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Un administrador autorizado registra la asistencia automáticamente al abrir este enlace.
      </p>
      <Card className="min-w-0 p-5 sm:p-8">
        <AttendanceRegistration key={token} token={token} />
        <noscript><p className="mt-4">Activa JavaScript para registrar tu asistencia automáticamente o pide ayuda al organizador. Sin JavaScript no se registra el ingreso.</p></noscript>
      </Card>
    </section>
  );
}

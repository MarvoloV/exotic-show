import type { Metadata } from "next";
import { AttendanceRegistration } from "@/components/attendance/attendance-registration";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Registro de asistencia",
  referrer: "strict-origin",
  robots: { index: false, follow: false },
};

export default async function AttendancePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // GET/HEAD, server rendering and prefetch must never look up or record a participant.
  return (
    <section className="mx-auto w-full min-w-0 max-w-lg space-y-6" aria-labelledby="attendance-title">
      <h1 id="attendance-title" className="text-3xl font-semibold tracking-tight">Registro de asistencia</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Abrir este enlace registra tu asistencia automáticamente. Si lo compartes, otra persona puede registrar tu asistencia en tu nombre. No compartas tu QR.
      </p>
      <Card className="min-w-0 p-5 sm:p-8">
        <AttendanceRegistration key={token} token={token} />
        <noscript><p className="mt-4">Activa JavaScript para registrar tu asistencia automáticamente o pide ayuda al organizador. Sin JavaScript no se registra el ingreso.</p></noscript>
      </Card>
    </section>
  );
}

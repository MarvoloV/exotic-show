import { Button } from "@/components/ui/button";
import { formatAttendance } from "@/lib/dates";
import type { AttendanceState } from "@/lib/attendance/result";

export function AttendanceStatus({ result, onRetry }: { result: AttendanceState; onRetry: () => void }) {
  const success = result.outcome === "recorded" || result.outcome === "already_recorded";
  const failed = result.outcome === "invalid" || result.outcome === "error";
  const title = {
    loading: "Registrando asistencia…",
    recorded: "Asistencia registrada",
    already_recorded: "Tu ingreso ya fue registrado",
    invalid: "Enlace no válido",
    error: "No pudimos confirmar tu asistencia",
  }[result.outcome];

  return (
    <div className="min-w-0 break-words" role={failed ? "alert" : "status"} aria-live={failed ? "assertive" : "polite"} aria-atomic="true" aria-busy={result.outcome === "loading"}>
      <p className={`mb-3 text-sm font-semibold ${failed ? "text-destructive" : "text-primary"}`}>
        {success ? "ASISTIÓ" : result.outcome === "loading" ? "Validando enlace" : "Revisa tu enlace"}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {success && (result.outcome === "recorded" || result.outcome === "already_recorded") && (
        <>
          <p className="mt-4 text-xl font-semibold">{result.full_name}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {result.outcome === "already_recorded" ? "Fecha y hora original: " : "Fecha y hora de ingreso: "}
            <time dateTime={result.attended_at}>{formatAttendance(result.attended_at)}</time> (Lima)
          </p>
        </>
      )}
      {result.outcome === "loading" && <p className="mt-4 text-muted-foreground">Espera un momento mientras confirmamos tu ingreso.</p>}
      {result.outcome === "invalid" && <p className="mt-4 text-muted-foreground">Este enlace no corresponde a un participante. Solicita al organizador tu QR correcto.</p>}
      {result.outcome === "error" && (
        <>
          <p className="mt-4 text-muted-foreground">El registro pudo haberse completado. Reintenta para comprobarlo: no se duplicará tu asistencia ni cambiará la hora original.</p>
          <Button type="button" className="mt-5 w-full whitespace-normal" onClick={onRetry}>Reintentar registro</Button>
        </>
      )}
    </div>
  );
}

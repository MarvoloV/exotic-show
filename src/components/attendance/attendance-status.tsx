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
    <div className={`attendance-result min-w-0 break-words ${failed ? "attendance-failed" : ""}`} role={failed ? "alert" : "status"} aria-live={failed ? "assertive" : "polite"} aria-atomic="true" aria-busy={result.outcome === "loading"}>
      <div className="attendance-outcome">
        <span className="attendance-outcome-icon" aria-hidden="true">{success ? "✓" : failed ? "!" : "…"}</span>
        <p className="attendance-badge">{success ? "ASISTIÓ" : result.outcome === "loading" ? "Validando enlace" : "Revisa tu enlace"}</p>
        <h2>{title}</h2>
        {result.outcome === "loading" && <p className="attendance-message">Espera un momento mientras confirmamos tu ingreso.</p>}
        {result.outcome === "invalid" && <p className="attendance-message">Este enlace no corresponde a un participante. Solicita al organizador tu QR correcto.</p>}
        {result.outcome === "error" && <p className="attendance-message">El registro pudo haberse completado. Reintenta para comprobarlo: no se duplicará tu asistencia ni cambiará la hora original.</p>}
      </div>
      {success && (result.outcome === "recorded" || result.outcome === "already_recorded") && (
        <div className="attendance-identity">
          <div><span>Nombre del participante</span><p>{result.full_name}</p></div>
          <div><span>Registro temporal</span><p>
            {result.outcome === "already_recorded" ? "Fecha y hora original: " : "Fecha y hora de ingreso: "}
            <time dateTime={result.attended_at}>{formatAttendance(result.attended_at)}</time> (Lima)
          </p></div>
        </div>
      )}
      {result.outcome === "error" && <Button type="button" className="attendance-retry" onClick={onRetry}>Reintentar registro</Button>}
    </div>
  );
}

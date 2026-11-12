import { csvCell } from "@/lib/csv";
import { formatAttendance } from "@/lib/dates";
import { formatAmount } from "@/lib/participants/format";
import type { ParticipantListRow } from "@/types/database";

export type ParticipantExportRow = Pick<ParticipantListRow,
  "code" | "full_name" | "attendance_state" | "attended_at" | "paid_amount"
>;

export function participantCsv(rows: ParticipantExportRow[]): string {
  const records = [
    ["Código", "Nombres y apellidos", "Estado", "Fecha de ingreso (America/Lima)", "Monto pagado"],
    ...rows.map((row) => [
      row.code,
      row.full_name,
      row.attendance_state,
      row.attended_at ? formatAttendance(row.attended_at) : "",
      formatAmount(row.paid_amount.toFixed(2)),
    ]),
  ];
  return records.map((record) => record.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

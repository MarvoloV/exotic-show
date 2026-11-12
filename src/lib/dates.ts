const attendanceFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function formatAttendance(value: string | null): string {
  return value === null ? "—" : attendanceFormatter.format(new Date(value));
}

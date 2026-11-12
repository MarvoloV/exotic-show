import type { AttendanceResult } from "@/types/database";

export type AttendanceState = AttendanceResult | { outcome: "loading" | "error" };

export function isAttendanceToken(token: unknown): token is string {
  // Length is explicit: JavaScript's $ also matches before a final newline.
  return typeof token === "string" && token.length === 64 && /^[a-f0-9]{64}$/.test(token);
}

export function safeAttendanceResult(value: unknown): AttendanceResult | null {
  if (!value || typeof value !== "object") return null;
  const { outcome, full_name, attended_at } = value as Record<string, unknown>;
  if (outcome === "invalid") return { outcome, full_name: null, attended_at: null };
  if (
    (outcome === "recorded" || outcome === "already_recorded") &&
    typeof full_name === "string" && full_name.trim().length > 0 &&
    typeof attended_at === "string" && Number.isFinite(Date.parse(attended_at))
  ) return { outcome, full_name, attended_at };
  return null;
}

export async function submitAttendance(token: string): Promise<AttendanceState> {
  if (!isAttendanceToken(token)) return { outcome: "invalid", full_name: null, attended_at: null };
  try {
    const response = await fetch(`/asistencia/${token}/registro`, {
      method: "POST", mode: "same-origin", credentials: "same-origin", cache: "no-store",
      referrerPolicy: "strict-origin", redirect: "error",
    });
    if (response.status !== 200 && response.status !== 404) return { outcome: "error" };
    const result = safeAttendanceResult(await response.json());
    if (result && ((response.status === 404) === (result.outcome === "invalid"))) return result;
  } catch {
    // Network/provider details and bearer URLs must never reach UI or logs.
  }
  return { outcome: "error" };
}

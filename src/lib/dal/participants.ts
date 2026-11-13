import "server-only";

import { requireAdmin } from "@/lib/dal/admin";
import { literalSearch, PAGE_SIZE, parseParticipantQuery, type SearchParams } from "@/lib/participants/query";
import type { DashboardMetrics, ParticipantListRow } from "@/types/database";
import type { ParticipantExportRow } from "@/lib/participants/csv";
import { INVALID_ID, isParticipantId, MUTATION_ERROR, validateParticipant } from "@/lib/participants/validation";
import { isQrToken, QR_ERROR } from "@/lib/participants/qr";
import { attendanceUrl } from "@/lib/qr";

const READ_ERROR = "No se pudieron cargar los datos administrativos.";
const LIST_COLUMNS = "id,code,full_name,paid_amount,attendance_state,attended_at";

function writableParticipant(input: unknown) {
  const result = validateParticipant(input);
  if (!result.ok) throw new Error("Revisa los campos indicados.");
  return result.value;
}

function assertMutation({ data, error }: { data: { id: string } | null; error: unknown }) {
  if (error || !data || !isParticipantId(data.id)) throw new Error(MUTATION_ERROR);
}

export async function createParticipant(input: unknown): Promise<void> {
  const { supabase } = await requireAdmin();
  const values = writableParticipant(input);
  try {
    // Omitting all other columns invokes the database's code/token/defaults.
    assertMutation(await supabase.from("participants").insert(values).select("id").single());
  } catch {
    throw new Error(MUTATION_ERROR);
  }
}

export async function updateParticipant(id: unknown, input: unknown): Promise<void> {
  const { supabase } = await requireAdmin();
  if (!isParticipantId(id)) throw new Error(INVALID_ID);
  const values = writableParticipant(input);
  try {
    assertMutation(await supabase.from("participants").update(values).eq("id", id).select("id").single());
  } catch {
    throw new Error(MUTATION_ERROR);
  }
}

// Preserve the original precision for PostgreSQL's timestamptz comparison.
export function isAttendanceTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

export async function resetAttendance(id: unknown, expected: unknown): Promise<void> {
  const { supabase } = await requireAdmin();
  if (!isParticipantId(id)) throw new Error(INVALID_ID);
  if (!isAttendanceTimestamp(expected)) throw new Error(MUTATION_ERROR);
  try {
    const { data, error } = await supabase.rpc("reset_participant_attendance", { participant_id: id, expected_attended_at: expected });
    if (error || data !== true) throw new Error(MUTATION_ERROR);
  } catch {
    throw new Error(MUTATION_ERROR);
  }
}

export async function deleteParticipant(id: unknown): Promise<void> {
  const { supabase } = await requireAdmin();
  if (!isParticipantId(id)) throw new Error(INVALID_ID);
  try {
    // UUID equality on the primary key cannot become an unbounded deletion.
    assertMutation(await supabase.from("participants").delete().eq("id", id).select("id").single());
  } catch {
    throw new Error(MUTATION_ERROR);
  }
}

export async function getParticipantQr(id: unknown): Promise<{ code: string; token: string }> {
  const { supabase } = await requireAdmin();
  if (!isParticipantId(id)) throw new Error(QR_ERROR);
  try {
    // Bearer capability: only approved-admin QR/list reads may expose it, never exports.
    const { data, error } = await supabase.from("participants").select("code,token").eq("id", id).single();
    if (error || !data || !isQrToken(data.token) || !/^EX[0-9]{3,}$/.test(data.code)) throw new Error(QR_ERROR);
    return { code: data.code, token: data.token };
  } catch {
    throw new Error(QR_ERROR);
  }
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { supabase } = await requireAdmin();
  try {
    const { data, error } = await supabase.rpc("admin_dashboard_metrics");
    if (error || !data || data.length !== 1) throw new Error(READ_ERROR);
    const row = data[0];
    if (![row.registered, row.attended, row.pending].every((value) => typeof value === "string" && /^\d+$/.test(value)) ||
      typeof row.paid_total !== "string" || !/^\d+\.\d{2}$/.test(row.paid_total) ||
      typeof row.attendance_percentage !== "string" || !/^\d+(?:\.\d)?$/.test(row.attendance_percentage)) throw new Error(READ_ERROR);
    return row;
  } catch {
    throw new Error(READ_ERROR);
  }
}

export async function getParticipantsForExport(params: SearchParams): Promise<ParticipantExportRow[]> {
  const { supabase } = await requireAdmin();
  const query = parseParticipantQuery(params);
  const rows: ParticipantExportRow[] = [];
  try {
    // Do not use the UI page or assume the provider's configured row cap.
    // Stable ordering matches the list, including its primary-key tie-breaker.
    for (;;) {
      let request = supabase.from("participants")
        .select("code,full_name,attendance_state,attended_at,paid_amount");
      if (query.q) request = request.or(literalSearch(query.q));
      if (query.state !== "all") request = request.eq("attendance_state", query.state === "pending" ? "PENDIENTE" : "ASISTIÓ");
      const { data, error } = await request
        .order(query.sort, { ascending: query.direction === "asc", nullsFirst: false })
        .order("id", { ascending: true })
        .range(rows.length, rows.length + 499);
      if (error || !data) throw new Error(READ_ERROR);
      if (data.length === 0) return rows;
      rows.push(...data);
    }
  } catch {
    throw new Error(READ_ERROR);
  }
}

export async function getParticipants(params: SearchParams) {
  const { supabase } = await requireAdmin();
  const query = parseParticipantQuery(params);
  try {
    // Only this authorized list needs bearer links; counts and exports do not.
    const filtered = <Columns extends string>(columns: Columns, head: boolean) => {
      let request = supabase.from("participants").select(columns, { count: "exact", head });
      if (query.q) request = request.or(literalSearch(query.q));
      if (query.state !== "all") request = request.eq("attendance_state", query.state === "pending" ? "PENDIENTE" : "ASISTIÓ");
      return request;
    };
    const { count, error } = await filtered(LIST_COLUMNS, true);
    if (error || count === null) throw new Error(READ_ERROR);
    query.page = Math.min(query.page, Math.max(1, Math.ceil(count / PAGE_SIZE)));
    let rows: ParticipantListRow[] = [];
    if (count > 0) {
      const start = (query.page - 1) * PAGE_SIZE;
      const response = await filtered(`${LIST_COLUMNS},token` as const, false)
        .order(query.sort, { ascending: query.direction === "asc", nullsFirst: false })
        .order("id", { ascending: true })
        .range(start, start + PAGE_SIZE - 1);
      if (response.error || !response.data) throw new Error(READ_ERROR);
      // Construct from the validated canonical origin, not request headers/input.
      // Strip the raw token before crossing the server/client boundary. Never log links.
      rows = response.data.map(({ token, ...row }) => ({ ...row, attendance_url: attendanceUrl(token) }));
    }
    return { rows, total: count, query };
  } catch {
    throw new Error(READ_ERROR);
  }
}

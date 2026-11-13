import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
function load(path, mocks = {}) {
  const output = ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiled = { exports: {} };
  runInNewContext(output, { module: compiled, exports: compiled.exports, FormData, Date, require(name) {
    if (name === "server-only") return {};
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) {
      const base = `../${name.slice(2)}`;
      return load(existsSync(new URL(`${base}.ts`, import.meta.url)) ? `${base}.ts` : `${base}.tsx`, mocks);
    }
    return require(name);
  } });
  return compiled.exports;
}
const id = "11111111-1111-4111-8111-111111111111";
const time = "2026-03-13T12:00:00.123456+00:00";
const initial = { status: "idle", message: "" };
const copy = (x) => JSON.parse(JSON.stringify(x));
function form(timestamp = time, participantId = id) {
  const f = new FormData(); f.append("id", participantId); f.append("attended_at", timestamp); return f;
}
function fixture({ approved = true, providerError = false } = {}) {
  const calls = [];
  const row = { id, code: "EX001", token: "a".repeat(64), full_name: "Ana", paid_amount: 10, attendance_state: "ASISTIÓ", attended_at: time };
  const supabase = { async rpc(name, args) {
    calls.push(["rpc", name, copy(args)]);
    if (providerError) return { data: null, error: { message: "private details" } };
    if (args.participant_id !== row.id) return { data: false, error: null };
    if (row.attendance_state === "PENDIENTE") return { data: true, error: null };
    if (row.attended_at !== args.expected_attended_at) return { data: false, error: null };
    row.attendance_state = "PENDIENTE"; row.attended_at = null;
    return { data: true, error: null };
  } };
  const mocks = { "@/lib/dal/admin": { requireAdmin: async () => { calls.push(["auth"]); if (!approved) throw Error("private"); return { supabase }; } }, "next/cache": { revalidatePath: (path) => calls.push(["revalidate", path]) } };
  const dal = load("./dal/participants.ts", mocks);
  const actions = load("../app/admin/participants/actions.ts", { ...mocks, "@/lib/dal/participants": dal });
  return { row, calls, dal, actions };
}

test("reset requires approval at both action and DAL without side effects", async () => {
  const f = fixture({ approved: false }); const before = copy(f.row);
  assert.equal((await f.actions.resetAttendanceAction(initial, form())).status, "error");
  assert.deepEqual(f.calls, [["auth"]]);
  await assert.rejects(f.dal.resetAttendance(id, time));
  assert.deepEqual(f.row, before);
});

test("reset rejects invalid or duplicate id and timestamp before RPC and revalidation", async () => {
  const f = fixture(); const before = copy(f.row);
  const duplicateId = form(); duplicateId.append("id", id);
  const duplicateTime = form(); duplicateTime.append("attended_at", time);
  const fileTime = form(); fileTime.set("attended_at", new Blob([time]));
  for (const input of [form(time, "all"), form(""), form("tomorrow"), form("2026-03-13"), duplicateId, duplicateTime, fileTime]) {
    assert.equal((await f.actions.resetAttendanceAction(initial, input)).status, "error");
  }
  await assert.rejects(f.dal.resetAttendance(id, "tomorrow"));
  assert.equal(f.calls.some(([kind]) => kind === "rpc" || kind === "revalidate"), false);
  assert.deepEqual(f.row, before);
});

test("successful reset changes only attendance, revalidates, and preserves QR for rescan", async () => {
  const f = fixture(); const before = copy(f.row);
  const result = await f.actions.resetAttendanceAction(initial, form());
  assert.equal(result.status, "success");
  assert.deepEqual(f.row, { ...before, attendance_state: "PENDIENTE", attended_at: null });
  assert.deepEqual(f.calls, [["auth"], ["auth"], ["rpc", "reset_participant_attendance", { participant_id: id, expected_attended_at: time }], ["revalidate", "/admin"], ["revalidate", "/admin/participants"]]);
  assert.equal((await f.actions.resetAttendanceAction(initial, form())).status, "success");
  // Model the existing record_attendance operation after reset, using the preserved token.
  assert.equal(f.row.token, before.token); f.row.attendance_state = "ASISTIÓ"; f.row.attended_at = "2026-03-14T12:00:00Z";
  const rescanned = copy(f.row); f.calls.length = 0;
  assert.equal((await f.actions.resetAttendanceAction(initial, form())).status, "error");
  assert.deepEqual(f.row, rescanned);
  assert.equal(f.calls.some(([kind]) => kind === "revalidate"), false);
});

test("missing row and provider errors are generic and do not revalidate or mutate", async () => {
  for (const [f, target] of [[fixture({ providerError: true }), id], [fixture(), "22222222-2222-4222-8222-222222222222"]]) {
    const before = copy(f.row);
    const result = await f.actions.resetAttendanceAction(initial, form(time, target));
    assert.equal(result.status, "error"); assert.doesNotMatch(result.message, /private/);
    assert.equal(f.calls.some(([kind]) => kind === "revalidate"), false); assert.deepEqual(f.row, before);
  }
});

test("migration structurally fences reset and serializes with attendance (not database proof)", () => {
  const sql = source("../../supabase/migrations/202603130003_reset_attendance.sql");
  for (const pattern of [/security definer/i, /set search_path = ''/i, /approved_administrators/i, /auth\.uid\(\)/i, /for update/i, /expected_attended_at/i, /attendance_state\s*=\s*'PENDIENTE'/i, /attended_at\s*=\s*null/i, /revoke all on function[\s\S]*from public, anon/i, /grant execute on function[\s\S]*to authenticated/i]) assert.match(sql, pattern);
  assert.doesNotMatch(sql, /grant\s+update/i);
});

test("reset form warns before explicit submit and reports errors without success callback", async () => {
  const React = require("react"); const render = require("react-dom/server").renderToStaticMarkup;
  const callbacks = [];
  for (const state of [initial, { status: "error", message: "No se pudo completar la operación. Intenta nuevamente." }]) {
    const { ParticipantResetForm } = load("../components/admin/participant-reset-form.tsx", { react: { ...React, useActionState: () => [state, () => {}, false] }, "@/app/admin/participants/actions": { resetAttendanceAction: async () => state } });
    const html = render(React.createElement(ParticipantResetForm, { participant: { id, attended_at: time }, onSuccess: () => callbacks.push(1) }));
    assert.match(html, /La fecha de ingreso anterior se borrará\. Un nuevo escaneo registrará una nueva fecha\./);
    assert.match(html, /Volver a pendiente/); assert.match(html, /name="attended_at"/);
    if (state.status === "error") assert.match(html, /role="alert"/);
  }
  assert.deepEqual(callbacks, []);
  for (const status of ["error", "success"]) {
    let submit;
    const { ParticipantResetForm } = load("../components/admin/participant-reset-form.tsx", {
      react: { ...React, useId: () => "reset", useActionState: (fn) => { submit = fn; return [initial, () => {}, false]; } },
      "@/app/admin/participants/actions": { resetAttendanceAction: async () => ({ status, message: "result" }) },
    });
    ParticipantResetForm({ participant: { id, attended_at: time }, onSuccess: () => callbacks.push(status) });
    await submit(initial, form());
  }
  assert.deepEqual(callbacks, ["success"]);
});

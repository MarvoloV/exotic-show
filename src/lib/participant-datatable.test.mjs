import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
const require = createRequire(import.meta.url);
const React = require("react");
const render = require("react-dom/server").renderToStaticMarkup;
function load(path, mocks = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(output, { module: compiled, exports: compiled.exports, URLSearchParams, Intl, Date, require(name) {
    if (name === "server-only") return {};
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) { const base = `../${name.slice(2)}`; return load(existsSync(new URL(`${base}.ts`, import.meta.url)) ? `${base}.ts` : `${base}.tsx`, mocks); }
    return require(name);
  } });
  return compiled.exports;
}
const queryModule = load("./participants/query.ts");
const row = { id: "1", code: "EX001", full_name: "Ana", paid_amount: 1, attendance_state: "PENDIENTE", attended_at: null, attendance_url: "https://example.test" };
const link = ({ children, ...props }) => React.createElement("a", props, children);
const mocks = { "next/link": { __esModule: true, default: link },
  "@/components/admin/participant-form": { DeleteParticipantForm: () => "Eliminar" },
  "@/components/admin/participant-edit-dialog": { ParticipantEditDialog: () => "Editar" },
  "@/components/admin/participant-qr": { ParticipantQr: () => "QR" },
  "@/components/admin/participant-attendance-link": { ParticipantAttendanceLink: () => "Copiar" },
};
function markup(query, rows = [row], total = 41) {
  const { ParticipantList } = load("../components/admin/participant-list.tsx", mocks);
  return render(React.createElement(ParticipantList, { rows, total, query }));
}
test("code sort toggles URL preserving filters and resetting page, with accessible desktop and mobile controls", () => {
  for (const [sort, direction, next, aria] of [["created_at", "desc", "asc", "none"], ["code", "asc", "desc", "ascending"], ["code", "desc", "asc", "descending"]]) {
    const query = { q: "Ana & Sol", state: "pending", sort, direction, page: 2 };
    const html = markup(query);
    const href = queryModule.participantHref({ ...query, sort: "code", direction: next }, 1).replaceAll("&", "&amp;");
    assert.equal(html.split(`href="${href}"`).length - 1, 2);
    assert.match(html, new RegExp(`aria-sort="${aria}"`));
    assert.match(html, /class="participants-mobile-sort"/);
    assert.match(html, /Ordenar por código/i);
  }
});
test("list preserves row actions, mobile labels, pagination and empty state", () => {
  const query = { q: "Ana", state: "pending", sort: "code", direction: "asc", page: 2 };
  const html = markup(query);
  for (const value of ["QR", "Editar", "Eliminar", "Copiar", "Ingreso:", "Pagó:", "page=3"]) assert.ok(html.includes(value), value);
  assert.match(markup(query, [], 0), /No se encontraron coincidencias/);
});
test("server sorts filtered entire dataset before pagination with stable id ordering", async () => {
  const data = Array.from({ length: 45 }, (_, i) => ({ id: String(i).padStart(3, "0"), code: `EX${String(44-i).padStart(3, "0")}`, full_name: "Ana", paid_amount: 1, attendance_state: i === 0 ? "ASISTIÓ" : "PENDIENTE", attended_at: null, token: "x" }));
  const orders = [];
  const supabase = { from() { let state, sort = []; const b = { select() { return b; }, or() { return b; }, eq(_c, value) { state = value; return b; }, order(column, options) { sort.push([column, options.ascending]); orders.push([column, options.ascending]); return b; }, range(start, end) { const rows = data.filter(r => !state || r.attendance_state === state).sort((a,b) => { for (const [key, asc] of sort) { const n = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0; if (n) return asc ? n : -n; } return 0; }); return Promise.resolve({ data: rows.slice(start, end + 1), error: null }); }, then(resolve) { return Promise.resolve({ count: data.filter(r => !state || r.attendance_state === state).length, error: null }).then(resolve); } }; return b; } };
  const dal = load("./dal/participants.ts", { "@/lib/dal/admin": { requireAdmin: async () => ({ supabase }) }, "@/lib/qr": { attendanceUrl: () => "link" } });
  for (const direction of ["asc", "desc"]) {
    const results = [];
    for (const page of ["1", "2", "3"]) results.push(...(await dal.getParticipants({ q: "Ana", state: "pending", sort: "code", direction, page })).rows.map(r => r.code));
    const expected = data.filter(r => r.attendance_state === "PENDIENTE").map(r => r.code).sort();
    if (direction === "desc") expected.reverse();
    assert.deepEqual(results, expected);
  }
  assert.ok(orders.some(([key, asc]) => key === "id" && asc));
});

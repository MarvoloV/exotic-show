import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const compiled = { exports: {} };
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports, Request, Response, URL, URLSearchParams, Intl, Date,
    require(name) {
      if (name === "server-only") return {};
      if (name in mocks) return mocks[name];
      if (name.startsWith("@/")) {
        const base = `../${name.slice(2)}`;
        return load(existsSync(new URL(`${base}.ts`, import.meta.url)) ? `${base}.ts` : `${base}.tsx`, mocks);
      }
      return require(name);
    },
  });
  return compiled.exports;
}
const json = (value) => JSON.parse(JSON.stringify(value));
const row = { code: "EX001", full_name: 'Ana, "Pérez"\r\n李🙂', attendance_state: "ASISTIÓ", attended_at: "2026-03-14T02:04:00Z", paid_amount: 12.3 };
const header = '"Código","Nombres y apellidos","Estado","Fecha de ingreso (America/Lima)","Monto pagado"\r\n';

test("CSV quotes commas, quotes, CR/LF and Unicode without changing ordinary cells", () => {
  const { csvCell } = load("./csv.ts");
  for (const [input, expected] of [["", '\"\"'], ["Ana", '\"Ana\"'], ['a,b"c\r\nd\ne', '\"a,b\"\"c\r\nd\ne\"'], ["José 李🙂", '\"José 李🙂\"'], ["a=b", '\"a=b\"'], ["12.30", '\"12.30\"']]) {
    assert.equal(csvCell(input), expected);
  }
});

test("CSV neutralizes each formula prefix even after whitespace, preserving original text", () => {
  const { csvCell } = load("./csv.ts");
  for (const prefix of ["=", "+", "-", "@"]) {
    for (const whitespace of ["", " ", "\t", "\r\n", "\u00a0\u2003"]) {
      const input = `${whitespace}${prefix}SUM(1,2)`;
      assert.equal(csvCell(input), `"'${input}"`);
    }
  }
  assert.equal(csvCell(' ="x"'), '"\' =""x"""');
});

test("participant CSV contains only five safe columns, Lima timestamps, blank pending dates and no currency", () => {
  const { participantCsv } = load("./participants/csv.ts");
  const rows = [{ ...row, token: "private-token", id: "private-id", attendance_url: "private-url", qr: "private-qr" }, { ...row, code: "EX002", full_name: " =1+1", attendance_state: "PENDIENTE", attended_at: null, paid_amount: 0 }];
  const before = JSON.stringify(rows);
  const expected = header + '"EX001","Ana, ""Pérez""\r\n李🙂","ASISTIÓ","13/03/2026, 21:04:00","12.30"\r\n' + '"EX002","\' =1+1","PENDIENTE","","0.00"\r\n';
  assert.equal(participantCsv(rows), expected);
  assert.equal(participantCsv(rows), expected);
  assert.equal(participantCsv([]), header);
  assert.equal(JSON.stringify(rows), before);
  assert.doesNotMatch(expected, /private-|S\/|\bUSD\b|\bPEN\b/);
});

function fixture({ approved = true, error = false, rows = Array.from({ length: 23 }, (_, i) => ({ ...row, code: `EX${i + 1}` })) } = {}) {
  const calls = [];
  const before = JSON.stringify(rows);
  const supabase = { from(table) {
    calls.push(["from", table]);
    let start;
    const builder = {};
    for (const method of ["select", "eq", "or", "order"]) builder[method] = (...args) => { calls.push([method, ...args]); return builder; };
    builder.range = (first, last) => { start = first; calls.push(["range", first, last]); return builder; };
    // Simulate a provider row cap smaller than the requested batch size.
    builder.then = (resolve, reject) => Promise.resolve({ data: error ? null : rows.slice(start, start + 7), error: error ? { message: "private provider details" } : null }).then(resolve, reject);
    return builder;
  } };
  const dal = load("./dal/participants.ts", {
    "@/lib/dal/admin": { requireAdmin: async () => {
      calls.push(["authorize"]);
      if (!approved) throw new Error("private auth details");
      return { supabase };
    } },
  });
  return { ...dal, calls, rows, unchanged: () => assert.equal(JSON.stringify(rows), before) };
}

test("export DAL independently authorizes before any reads", async () => {
  const f = fixture({ approved: false });
  await assert.rejects(f.getParticipantsForExport({}), { message: "private auth details" });
  assert.deepEqual(f.calls, [["authorize"]]);
  f.unchanged();
});

test("export reads all matching rows past UI/provider pages and forwards normalized literal filters and stable sort", async () => {
  const f = fixture();
  const result = await f.getParticipantsForExport({ q: '  Ana,%_*"  ', state: "pending", sort: "full_name", direction: "asc", page: "999" });
  assert.deepEqual(json(result), f.rows);
  const search = load("./participants/query.ts").literalSearch('Ana,%_*"');
  assert.deepEqual(f.calls[0], ["authorize"]);
  assert.deepEqual(f.calls.filter(([method]) => method === "range").map(([, first]) => first), [0, 7, 14, 21, 23]);
  for (const [, columns] of f.calls.filter(([method]) => method === "select")) assert.equal(columns, "code,full_name,attendance_state,attended_at,paid_amount");
  for (const call of f.calls.filter(([method]) => method === "or")) assert.deepEqual(call, ["or", search]);
  for (const call of f.calls.filter(([method]) => method === "eq")) assert.deepEqual(call, ["eq", "attendance_state", "PENDIENTE"]);
  assert.deepEqual(json(f.calls.filter(([method]) => method === "order").slice(0, 2)), [["order", "full_name", { ascending: true, nullsFirst: false }], ["order", "id", { ascending: true }]]);
  f.unchanged();
});

test("export applies existing defaults for invalid/duplicate query values and supports attended/empty results", async () => {
  const f = fixture({ rows: [] });
  assert.deepEqual(json(await f.getParticipantsForExport({ q: ["Ana", "Bob"], state: "token", sort: "token", direction: "bad" })), []);
  assert.equal(f.calls.some(([method]) => method === "or" || method === "eq"), false);
  assert.deepEqual(json(f.calls.filter(([method]) => method === "order")), [["order", "created_at", { ascending: false, nullsFirst: false }], ["order", "id", { ascending: true }]]);
  const attended = fixture({ rows: [] });
  await attended.getParticipantsForExport({ state: "attended" });
  assert.deepEqual(attended.calls.find(([method]) => method === "eq"), ["eq", "attendance_state", "ASISTIÓ"]);
});

test("export DAL hides provider errors without modifying stored rows", async () => {
  const f = fixture({ error: true });
  await assert.rejects(f.getParticipantsForExport({}), { message: "No se pudieron cargar los datos administrativos." });
  f.unchanged();
});

function route({ approved = true, fail = false } = {}) {
  const calls = [];
  const handler = load("../app/admin/participants/export/route.ts", {
    "@/lib/dal/admin": { requireAdmin: async () => { calls.push("authorize"); if (!approved) throw new Error("private auth details"); } },
    "@/lib/dal/participants": { getParticipantsForExport: async (params) => { calls.push(json(params)); if (fail) throw new Error("private provider details"); return [row]; } },
  });
  return { ...handler, calls };
}
function privateHeaders(response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
}

test("download authorizes independently, forwards only filters and serves exact UTF-8 attachment", async () => {
  const f = route();
  const response = await f.GET(new Request("https://example.test/admin/participants/export?q=Ana&q=Bob&state=pending&sort=code&direction=asc&page=9&token=private"));
  assert.equal(f.dynamic, "force-dynamic");
  assert.deepEqual(f.calls, ["authorize", { q: ["Ana", "Bob"], state: "pending", sort: "code", direction: "asc" }]);
  assert.equal(response.status, 200);
  privateHeaders(response);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="participantes.csv"');
  const expected = load("./participants/csv.ts").participantCsv([row]);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(expected, "utf8"));
});

for (const [options, status, message] of [[{ approved: false }, 403, "Acceso administrativo no autorizado."], [{ fail: true }, 500, "No se pudo exportar el listado. Intenta nuevamente."]]) {
  test(`download returns safe private ${status} errors without attachments or partial CSV`, async () => {
    const f = route(options);
    const response = await f.GET(new Request("https://example.test/admin/participants/export"));
    assert.equal(response.status, status);
    privateHeaders(response);
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(response.headers.get("content-disposition"), null);
    assert.equal(await response.text(), message);
    if (!options.approved && !options.fail) assert.deepEqual(f.calls, ["authorize"]);
  });
}

test("export control is accessible and forwards normalized filters, not the UI page or private data", () => {
  const query = load("./participants/query.ts").parseParticipantQuery({ q: "  Ana & 李  ", state: "attended", sort: "paid_amount", direction: "asc", page: "3" });
  const { ParticipantExport } = load("../components/admin/participant-export.tsx");
  const html = require("react-dom/server").renderToStaticMarkup(require("react").createElement(ParticipantExport, { query }));
  assert.match(html, /<form[^>]*action="\/admin\/participants\/export"/);
  assert.match(html, /method="get"/);
  assert.match(html, /aria-describedby="export-hint"/);
  assert.match(html, /<button[^>]*type="submit"[^>]*>Exportar CSV<\/button>/);
  for (const [key, value] of Object.entries({ q: "Ana &amp; 李", state: "attended", sort: "paid_amount", direction: "asc" })) assert.ok(html.includes(`name="${key}" value="${value}"`));
  assert.doesNotMatch(html, /name="(?:page|token)"/);
  for (const text of ["todas las coincidencias", "America/Lima", "sin moneda", "código", "nombre", "estado", "ingreso", "monto"]) assert.ok(html.includes(text), text);
});

test("participant page exposes export alongside the existing search and registration controls, even when empty", async () => {
  const React = require("react");
  const query = load("./participants/query.ts").parseParticipantQuery({ q: "Ana", state: "pending" });
  const { default: Page } = load("../app/admin/participants/page.tsx", {
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/form": { __esModule: true, default: ({ children, ...props }) => React.createElement("form", props, children) },
    "@/components/admin/participant-form": { ParticipantForm: () => null },
    "@/components/admin/participant-list": { ParticipantList: () => null },
    "@/components/admin/refresh-button": { RefreshButton: () => null },
    "@/lib/dal/participants": { getParticipants: async () => ({ rows: [], total: 0, query }) },
  });
  const html = require("react-dom/server").renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ q: "Ana" }) }));
  for (const text of ["Exportar CSV", "Registrar participante", "Buscar", "Nombre o código"]) assert.ok(html.includes(text), text);
  assert.match(html, /name="q" value="Ana"/);
});

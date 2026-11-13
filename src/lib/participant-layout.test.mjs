import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
function load(path, mocks = {}, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(output, { module: compiled, exports: compiled.exports, URLSearchParams, ...globals, require: (name) => name in mocks ? mocks[name] : require(name) });
  return compiled.exports;
}
const queryModule = load("./participants/query.ts");
const q = { q: "Ana & Sol", state: "pending", sort: "full_name", direction: "asc", page: 2 };
const row = { id: "1", code: "EX001", full_name: "Ana Sol", paid_amount: 10.5, attendance_state: "ASISTIÓ", attended_at: "2026-03-14T02:04:00Z", attendance_url: "https://example.test/private" };
function element(tag) { return function Element({ children, ...props }) { return React.createElement(tag, props, children); }; }
function marker(name) { return function Marker({ participant }) { return React.createElement("span", { "data-action": name }, participant?.code ?? "registro"); }; }
const mocks = {
  "next/link": { default: element("a") }, "next/form": { default: element("form") },
  "@/lib/participants/query": queryModule,
  "@/lib/dates": { formatAttendance: () => "13/03/2026, 21:04:00" },
  "@/lib/participants/format": { formatAmount: (amount) => amount },
  "@/components/ui/table": { Table: element("table"), TableHead: element("th"), TableCell: element("td") },
  "@/components/ui/button": { Button: element("button"), buttonVariants: () => "button" },
  "@/components/ui/input": { Input: element("input") },
  "@/components/admin/participant-form": { ParticipantForm: marker("edit-form"), DeleteParticipantForm: marker("delete") },
  "@/components/admin/participant-edit-dialog": { ParticipantEditDialog: ({ participant }) => React.createElement(React.Fragment, null, React.createElement("button", { "data-action": "edit", "aria-haspopup": "dialog" }, `Editar ${participant.code}`), React.createElement("dialog", { "aria-label": "Editar participante" })) },
  "@/components/admin/participant-registration-dialog": { ParticipantRegistrationDialog: () => React.createElement("button", null, "+ Registrar participante") },
  "@/components/admin/participant-qr": { ParticipantQr: marker("qr") },
  "@/components/admin/participant-attendance-link": { ParticipantAttendanceLink: marker("copy") },
  "@/components/admin/participant-export": { ParticipantExport: () => React.createElement("span", null, "Exportar CSV") },
  "@/components/admin/refresh-button": { RefreshButton: () => React.createElement("button", null, "Actualizar datos") },
};
const { ParticipantList } = load("../components/admin/participant-list.tsx", mocks);
async function page(result) {
  const pageModule = load("../app/admin/participants/page.tsx", { ...mocks, "@/components/admin/participant-list": { ParticipantList }, "@/lib/dal/participants": { getParticipants: async () => result } });
  return renderToStaticMarkup(await pageModule.default({ searchParams: Promise.resolve({}) }));
}
test("participants page defaults to code ascending while preserving explicit sorts and filters", async () => {
  const calls = [];
  const pageModule = load("../app/admin/participants/page.tsx", { ...mocks, "@/components/admin/participant-list": { ParticipantList }, "@/lib/dal/participants": { getParticipants: async (params) => {
    calls.push(params);
    return { rows: [row], total: 1, query: queryModule.parseParticipantQuery(params) };
  } } });
  for (const [params, expected] of [
    [{}, { sort: "code", direction: "asc" }],
    [{ sort: "code", direction: "desc" }, { sort: "code", direction: "desc" }],
    [{ sort: "created_at" }, { sort: "created_at" }],
    [{ q: "Ana", state: "pending", page: "2" }, { q: "Ana", state: "pending", page: "2", sort: "code", direction: "asc" }],
    [{ sort: ["code"], direction: ["asc"] }, { sort: ["code"], direction: ["asc"] }],
    [{ sort: "invalid", direction: "invalid" }, { sort: "invalid", direction: "invalid" }],
  ]) {
    const html = renderToStaticMarkup(await pageModule.default({ searchParams: Promise.resolve(params) }));
    assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), expected);
    if (!params.sort) assert.match(html, /aria-sort="ascending"/);
    if (params.sort === "created_at") assert.match(html, /name="direction" value="desc"/);
  }
});
test("filtered count, query-preserving quick links and form render even at zero", async () => {
  for (const total of [0, 41]) {
    const html = await page({ rows: total ? [row] : [], total, query: q });
    assert.match(html, new RegExp(`${total} participantes`));
    assert.equal((html.match(/Control de Participantes/g) || []).length, 1);
    assert.match(html, /Listado de participantes/);
    for (const state of ["all", "attended", "pending"]) {
      const url = queryModule.participantHref({ ...q, state }, 1).replaceAll("&", "&amp;");
      assert.ok(html.includes(`href="${url}"`), state);
    }
    for (const name of ["q", "state", "sort", "direction"]) assert.match(html, new RegExp(`name="${name}"`));
    assert.doesNotMatch(html, /Filtros y orden|Dirección|Aplicar filtros|<select/);
    assert.match(html, /type="search"/);
    assert.match(html, />Buscar<\/button>/);
    for (const [name, value] of [["state", q.state], ["sort", q.sort], ["direction", q.direction]]) {
      assert.ok(html.includes(`type="hidden" name="${name}" value="${value}"`));
    }
    assert.match(html, /Registrar participante/); assert.match(html, /Exportar CSV/); assert.match(html, /Actualizar datos/);
    if (!total) assert.match(html, /No se encontraron coincidencias/);
  }
});
test("one responsive semantic row retains real values, actions and pagination", () => {
  const html = renderToStaticMarkup(React.createElement(ParticipantList, { rows: [row], total: 41, query: q }));
  for (const text of ["EX001", "Ana Sol", "ASISTIÓ", "13/03/2026, 21:04:00", "10.50", "Página 2 de 3"]) assert.ok(html.includes(text), text);
  assert.match(html, /dateTime="2026-03-14T02:04:00Z"/);
  assert.equal((html.match(/scope="col"/g) || []).length, 7);
  for (const name of ["qr", "copy", "edit", "delete"]) assert.equal((html.match(new RegExp(`data-action="${name}"`, "g")) || []).length, 1);
  for (const page of [1, 3]) assert.ok(html.includes(queryModule.participantHref(q, page).replaceAll("&", "&amp;")));
  assert.doesNotMatch(html, /<details/); assert.match(html, /Acciones/);
  assert.match(html, /data-action="edit" aria-haspopup="dialog"/);
  assert.match(html, /<dialog aria-label="Editar participante"/);
  assert.match(html, /class="participant-actions-group"/);
  assert.doesNotMatch(html, /S\//);
  const empty = renderToStaticMarkup(React.createElement(ParticipantList, { rows: [], total: 41, query: q }));
  assert.match(empty, /El listado cambió durante la consulta/);
});
test("compact copy hides the input in a disclosure and opens fallback on error; default stays visible", async () => {
  let state = "idle";
  const { ParticipantAttendanceLink } = load("../components/admin/participant-attendance-link.tsx", {
    react: { ...React, useId: () => "copy-test", useState: () => [state, (value) => { state = value; }] },
    "@/components/ui/button": mocks["@/components/ui/button"],
  }, { navigator: { clipboard: { writeText: async () => { throw new Error("denied"); } } } });
  const props = { participant: row };
  const normal = renderToStaticMarkup(ParticipantAttendanceLink(props));
  assert.match(normal, /<input/); assert.doesNotMatch(normal, /<details/);
  let tree = ParticipantAttendanceLink({ ...props, compact: true });
  let html = renderToStaticMarkup(tree);
  assert.match(html, /<details[^>]*><summary>Ver enlace/);
  assert.doesNotMatch(html, /<details[^>]* open=/);
  assert.match(html, /<input[^>]*readOnly/);
  const children = React.Children.toArray(tree.props.children);
  await children.find((node) => node.type === "button").props.onClick();
  tree = ParticipantAttendanceLink({ ...props, compact: true });
  html = renderToStaticMarkup(tree);
  assert.match(html, /<details[^>]* open=""/);
  assert.match(html, /No se pudo copiar el enlace\. Selecciónalo y cópialo manualmente\./);
  assert.doesNotMatch(html, /href=|denied/);
});
test("route styles isolate shell and reflow table into mobile cards", () => {
  assert.match(css, /body:has\(\.admin-shell\)\s*>\s*header/);
  assert.match(css, /\.admin-shell:has\(\.participants-screen\)\s*>\s*\.admin-shell-nav/);
  assert.match(css, /@media\s*\(max-width:\s*\d+px\)[\s\S]*\.participants-screen[^}]*table/);
  assert.match(css, /\.participants-screen[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.participant-link[^}]*grid-column:\s*1/);
  assert.match(css, /\.participant-actions[^}]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /\.participant-actions-group\s*\{[^}]*display:\s*flex/);
});

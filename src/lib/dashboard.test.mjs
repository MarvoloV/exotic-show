import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  if (typeof node.type === "function") return nodes(node.type(node.props));
  return [node, ...nodes(node.props?.children)];
}
async function render(metrics) {
  let calls = 0;
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": { default: "link" },
    "@/lib/dal/participants": { getDashboardMetrics: async () => { calls++; return metrics; } },
    "@/lib/participants/format": { formatAmount: (n) => `formatted:${n}` },
    "@/components/ui/card": { Card: "card" },
    "@/components/ui/button": { buttonVariants: () => "button" },
    "@/components/admin/refresh-button": { RefreshButton: "refresh" },
  };
  const compiled = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(output, { module: compiled, exports: compiled.exports, require: (name) => { if (!(name in mocks)) throw Error(name); return mocks[name]; } });
  const view = nodes(await compiled.exports.default());
  assert.equal(calls, 1);
  return view;
}
for (const m of [
  { registered: "0", attended: "0", pending: "0", paid_total: "0.00", attendance_percentage: "0.0" },
  { registered: "8", attended: "3", pending: "5", paid_total: "1234567890123.00", attendance_percentage: "37.5" },
]) {
  test(`dashboard displays aggregate metrics and accessible ring at ${m.attendance_percentage}%`, async () => {
    const view = await render(m);
    const text = JSON.stringify(view);
    for (const value of [m.registered, m.attended, m.pending, `formatted:${m.paid_total}`, `${m.attendance_percentage}%`]) assert.ok(text.includes(String(value)));
    for (const label of ["Participantes registrados", "Participantes que asistieron", "Participantes pendientes", "Total de pagos registrados", "Porcentaje de asistencia"]) assert.ok(text.includes(label));
    const ring = view.find((n) => n.props?.role === "img" && n.props?.["aria-label"]?.includes("asistencia"));
    assert.ok(ring);
    assert.match(ring.props["aria-label"], new RegExp(`${m.attendance_percentage}%`));
    assert.equal(ring.props.style["--attendance"], `${m.attendance_percentage}%`);
    assert.equal(view.filter((n) => n.type === "refresh").length, 1);
    assert.ok(view.some((n) => n.type === "link" && n.props.href === "/admin/participants"));
    assert.doesNotMatch(text, /aforo|VIP|scanner|S\//i);
  });
}
test("dashboard styles are scoped and responsive with wrapping values", () => {
  assert.match(css, /body:has\(\.admin-shell\)\s*>\s*header/);
  assert.match(css, /body:has\(\.admin-shell\)\s*>\s*main#contenido/);
  assert.match(css, /\.admin-shell:has\(\.admin-dashboard\)\s*>\s*\.admin-shell-nav/);
  assert.match(css, /@media\s*\(min-width:\s*1024px\)/);
  assert.match(css, /\.dashboard-metrics[^}]*grid-template-columns/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /conic-gradient\([^;]*var\(--attendance\)/);
});

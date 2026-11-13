import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, mocks = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const jsx = (type, props) => ({ type, props });
  runInNewContext(output, { module: compiled, exports: compiled.exports, require: (name) => name === "react/jsx-runtime" ? { jsx, jsxs: jsx } : mocks[name] ?? (() => { throw Error(name); })() });
  return compiled.exports;
}
function nodes(node) { return Array.isArray(node) ? node.flatMap(nodes) : !node || typeof node !== "object" ? [] : [node, ...nodes(node.props?.children)]; }

test("route marker distinguishes protected, login and public paths", () => {
  for (const [path, theme] of [["/admin", "admin"], ["/admin/participants", "admin"], ["/login", "login"], ["/", undefined], ["/administrator", undefined], ["/login/other", undefined]]) {
    const marker = load("../components/route-theme.tsx", { "next/navigation": { usePathname: () => path } });
    assert.equal(marker.RouteTheme()?.props["data-route-theme"], theme, path);
  }
});
test("root places route marker outside children and keeps public structure", () => {
  const root = load("../app/layout.tsx", { "next/font/google": { Geist: () => ({ variable: "geist" }) }, "@/lib/utils": { cn: (...args) => args.join(" ") }, "@/components/site-header": { SiteHeader: "header" }, "@/components/route-theme": { RouteTheme: "marker" }, "./globals.css": {} });
  const child = { type: "child", props: {} };
  const all = nodes(root.default({ children: child }));
  const body = all.find((n) => n.type === "body");
  assert.ok(body.props.children.some((n) => n.type === "marker"));
  assert.ok(all.some((n) => n.type === "main" && n.props.children === child));
  assert.ok(all.some((n) => n.type === "header")); assert.ok(all.some((n) => n.type === "footer"));
});
test("loading chooses skeleton only for admin; public and login remain generic", () => {
  const skeleton = load("../components/admin/admin-skeleton.tsx").AdminSkeleton;
  for (const path of ["/admin", "/admin/participants", "/login", "/", "/administrator"]) {
    const navigation = { usePathname: () => path };
    const route = load("../components/route-theme.tsx", { "next/navigation": navigation });
    const loading = load("../app/loading.tsx", { "next/navigation": navigation, "@/components/route-theme": route, "@/components/admin/admin-skeleton": { AdminSkeleton: skeleton } }).default();
    assert.equal(loading.type === skeleton, path === "/admin" || path.startsWith("/admin/"), path);
    if (loading.type !== skeleton) assert.equal(loading.props.children, "Cargando…");
  }
  const admin = load("../app/admin/loading.tsx", { "@/components/admin/admin-skeleton": { AdminSkeleton: skeleton } }).default();
  assert.equal(admin.type, skeleton);
});
test("skeleton announces once and contains only hidden shapes", () => {
  const tree = load("../components/admin/admin-skeleton.tsx").AdminSkeleton();
  const all = nodes(tree); const statuses = all.filter((n) => n.props?.role === "status");
  assert.equal(statuses.length, 1); assert.match(JSON.stringify(statuses[0]), /Cargando datos administrativos…/);
  assert.ok(all.some((n) => n.props?.["aria-hidden"] === "true"));
  assert.ok(!all.some((n) => ["a", "button", "input"].includes(n.type)));
  assert.doesNotMatch(JSON.stringify(tree), /Ana|S\/|ASISTIÓ/);
});
test("route styles isolate dark shell and offer responsive static placeholders", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /body:has\(\[data-route-theme="admin"\]\)/);
  assert.match(css, /body:has\(\[data-route-theme="login"\]\)/);
  for (const name of ["metrics", "table", "cards"]) assert.match(css, new RegExp(`\\.admin-skeleton-${name}`));
  assert.match(css, /@media\s*\(min-width:\s*768px\)/);
  assert.doesNotMatch(css, /\.admin-skeleton[^}]*animation\s*:/);
});

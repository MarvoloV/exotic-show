import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
function load(path, mocks) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(output, { module: compiled, exports: compiled.exports, require: (name) => { if (!(name in mocks)) throw Error(name); return mocks[name]; } });
  return compiled.exports;
}
const jsx = (type, props) => ({ type, props });
const base = { "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": { default: "link" }, "@/components/ui/button": { Button: "button", buttonVariants: () => "outline" } };
function nodes(node) { return Array.isArray(node) ? node.flatMap(nodes) : !node || typeof node !== "object" ? [] : [node, ...nodes(node.props?.children)]; }

test("admin layout retains shell and navigation for loading and error states", async () => {
  let guards = 0;
  const layout = load("../app/admin/layout.tsx", { ...base, "next/navigation": { redirect: () => { throw Error("unexpected redirect"); } }, "@/lib/dal/admin": { requireAdmin: async () => { guards++; } }, "@/components/admin/sign-out-form": { SignOutForm: "signout" } });
  assert.equal(layout.dynamic, "force-dynamic");
  let resets = 0;
  const skeleton = load("../components/admin/admin-skeleton.tsx", base).AdminSkeleton;
  const loading = load("../app/admin/loading.tsx", { ...base, "@/components/admin/admin-skeleton": { AdminSkeleton: skeleton } }).default().type();
  const error = load("../app/admin/error.tsx", base).default({ reset: () => { resets++; } });
  assert.equal(loading.props.role, "status");
  assert.match(JSON.stringify(loading), /Cargando datos administrativos…/);
  assert.equal(error.props.role, "alert");
  nodes(error).find((n) => n.type === "button").props.onClick();
  assert.equal(resets, 1);
  for (const child of [loading, error]) {
    const tree = await layout.default({ children: child });
    assert.match(tree.props.className, /\badmin-shell\b/);
    const nav = nodes(tree).find((n) => n.type === "nav");
    assert.match(nav.props.className, /\badmin-shell-nav\b/);
    assert.equal(nav.props["aria-label"], "Administración");
    assert.deepEqual(nodes(nav).filter((n) => n.type === "link").map((n) => n.props.href), ["/admin", "/admin/participants"]);
    assert.ok(nodes(nav).some((n) => n.type === "signout"));
    assert.ok(nodes(tree).includes(child));
  }
  assert.equal(guards, 2);
});

test("admin guard failure redirects to login", async () => {
  let calls = 0;
  const layout = load("../app/admin/layout.tsx", { ...base, "next/navigation": { redirect: (url) => { throw Error(url); } }, "@/lib/dal/admin": { requireAdmin: async () => { calls++; throw Error("denied"); } }, "@/components/admin/sign-out-form": { SignOutForm: "signout" } });
  await assert.rejects(layout.default({ children: null }), /\/login\?status=unauthorized/);
  assert.equal(calls, 1);
});

test("shell styles and semantic tokens apply without page markers", () => {
  assert.match(css, /body:has\(\.admin-shell\)\s*\{[^}]*--dash-canvas/);
  for (const token of ["background", "foreground", "card", "card-foreground", "primary", "primary-foreground", "muted", "muted-foreground", "border", "ring", "destructive"]) assert.match(css, new RegExp(`body:has\\(\\.admin-shell\\)\\s*\\{[^}]*--${token}:`));
  for (const tag of ["header", "footer", "main#contenido"]) assert.match(css, new RegExp(`body:has\\(\\.admin-shell\\)\\s*>\\s*${tag.replace("#", "#")}`));
  assert.match(css, /\.admin-shell\s*>\s*\.admin-shell-nav/);
  assert.doesNotMatch(css, /body:has\(\.(?:admin-dashboard|participants-screen)\)\s*>\s*(?:header|footer|main)/);
});

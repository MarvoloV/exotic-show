import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const token = "a".repeat(64);
const id = "11111111-1111-4111-8111-111111111111";
const url = `https://canonical.test/asistencia/${token}`;
const safeError = "No se pudo cargar el QR. Intenta nuevamente.";
function load(path, mocks = {}, env = { NEXT_PUBLIC_SITE_URL: "https://canonical.test/" }) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const compiled = { exports: {} };
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports, Request, Response, URL, URLSearchParams, Intl, Date, Buffer, process: { env },
    navigator: mocks.navigator ?? {}, console: mocks.console ?? console,
    require(name) {
      if (name === "server-only") return {};
      if (name in mocks) return mocks[name];
      if (name.startsWith("@/")) {
        const base = `../${name.slice(2)}`;
        return load(existsSync(new URL(`${base}.ts`, import.meta.url)) ? `${base}.ts` : `${base}.tsx`, mocks, env);
      }
      return require(name);
    },
  });
  return compiled.exports;
}
const json = (value) => JSON.parse(JSON.stringify(value));

test("QR uses the validated canonical origin, preserves tokens and renders deterministic local PNG", async () => {
  const { attendanceUrl, qrPng } = load("./qr.ts");
  assert.equal(attendanceUrl(token), url);
  assert.equal(attendanceUrl(token), url);
  assert.notEqual(attendanceUrl("b".repeat(64)), url);
  const png = await qrPng(url);
  assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.deepEqual(png, await require("qrcode").toBuffer(url, { type: "png", errorCorrectionLevel: "M", margin: 4, width: 320 }));
  assert.deepEqual(png, await qrPng(url));
  for (const bad of [null, "", "a".repeat(63), "a".repeat(65), "A".repeat(64), ` ${token}`, "../admin", `${token}?x=1`]) {
    assert.throws(() => attendanceUrl(bad), { message: safeError });
  }
  for (const origin of [undefined, "https://user:pass@canonical.test", "https://canonical.test/path", "https://canonical.test?x=1", "https://canonical.test#x", "http://remote.test", "javascript:alert(1)"]) {
    assert.throws(() => load("./qr.ts", {}, { NEXT_PUBLIC_SITE_URL: origin }).attendanceUrl(token));
  }
  assert.equal(load("./qr.ts", {}, { NEXT_PUBLIC_SITE_URL: "http://localhost:3000/" }).attendanceUrl(token), `http://localhost:3000/asistencia/${token}`);
});

function fixture({ approved = true, data = { code: "EX001", token }, error = false } = {}) {
  const calls = [];
  const stored = { ...data, attendance_state: "PENDIENTE", attended_at: null, sequence: 9 };
  const before = JSON.stringify(stored);
  const mocks = {
    "@/lib/dal/admin": { requireAdmin: async () => {
      calls.push(["authorize"]);
      if (!approved) throw new Error(`private auth ${token}`);
      return { supabase: { from(table) {
        calls.push(["from", table]);
        const builder = {
          select(columns) { calls.push(["select", columns]); return builder; },
          eq(column, value) { calls.push(["eq", column, value]); return builder; },
          async single() { calls.push(["single"]); if (error) throw new Error(`private provider ${token}`); return { data, error: null }; },
        };
        return builder;
      } } };
    } },
  };
  return { calls, mocks, dal: load("./dal/participants.ts", mocks), unchanged: () => assert.equal(JSON.stringify(stored), before) };
}

test("QR DAL independently authorizes and only reads the selected participant's immutable token/code", async () => {
  const f = fixture();
  assert.deepEqual(json(await f.dal.getParticipantQr(id)), { code: "EX001", token });
  assert.deepEqual(json(await f.dal.getParticipantQr(id)), { code: "EX001", token });
  assert.deepEqual(f.calls.slice(0, 5), [["authorize"], ["from", "participants"], ["select", "code,token"], ["eq", "id", id], ["single"]]);
  f.unchanged();
  const denied = fixture({ approved: false });
  await assert.rejects(denied.dal.getParticipantQr(id));
  assert.deepEqual(denied.calls, [["authorize"]]);
  denied.unchanged();
});

test("QR DAL rejects malformed identifiers before reads, and missing/bad/provider data safely", async () => {
  const f = fixture();
  for (const bad of [null, "", "all", `${id},id.neq.x`, ` ${id}`]) await assert.rejects(f.dal.getParticipantQr(bad), { message: safeError });
  assert.equal(f.calls.some(([method]) => method === "from"), false);
  f.unchanged();
  for (const options of [{ data: null }, { data: { code: 'EX001\r\nInjected: x', token } }, { data: { code: "EX001", token: "bad" } }, { error: true }]) {
    const bad = fixture(options);
    await assert.rejects(bad.dal.getParticipantQr(id), { message: safeError });
    bad.unchanged();
  }
});

function entry(options = {}) {
  const f = fixture(options);
  const mocks = { ...f.mocks, "@/lib/dal/participants": f.dal };
  return { ...f, ...load("../app/admin/participants/[id]/qr/route.ts", mocks), ...load("../app/admin/participants/qr-actions.ts", mocks) };
}
function privateHeaders(response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
}

test("PNG attachment route independently authorizes, ignores host/query headers and never mutates attendance", async () => {
  const f = entry();
  const response = await f.GET(new Request(`https://evil.test/admin/participants/${id}/qr?token=forged&origin=https://evil.test`, { headers: { host: "evil.test", "x-forwarded-host": "evil.test" } }), { params: Promise.resolve({ id }) });
  assert.equal(f.dynamic, "force-dynamic");
  assert.equal(response.status, 200);
  privateHeaders(response);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="QR-EX001.png"');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), await load("./qr.ts").qrPng(url));
  assert.deepEqual(f.calls, [["authorize"], ["authorize"], ["from", "participants"], ["select", "code,token"], ["eq", "id", id], ["single"]]);
  f.unchanged();
});

for (const [options, status, message] of [[{ approved: false }, 403, "Acceso administrativo no autorizado."], [{ error: true }, 500, safeError], [{ data: null }, 500, safeError]]) {
  test(`PNG errors are private safe responses (${status}, ${JSON.stringify(options)})`, async () => {
    const f = entry(options);
    const response = await f.GET(new Request("https://evil.test"), { params: Promise.resolve({ id }) });
    assert.equal(response.status, status);
    privateHeaders(response);
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(response.headers.get("content-disposition"), null);
    assert.equal(await response.text(), message);
    assert.equal(f.calls.filter(([method]) => method === "authorize").length, options.approved === false ? 1 : 2);
    f.unchanged();
  });
}

test("preview action independently authorizes and returns only the canonical read-only link and local PNG", async () => {
  const f = entry();
  const result = await f.getParticipantQrAction(id);
  assert.deepEqual(json(result), { ok: true, url, image: `data:image/png;base64,${(await load("./qr.ts").qrPng(url)).toString("base64")}` });
  assert.equal(f.calls.filter(([method]) => method === "authorize").length, 2);
  f.unchanged();
  for (const options of [{ approved: false }, { error: true }, { data: null }]) {
    const bad = entry(options);
    assert.deepEqual(json(await bad.getParticipantQrAction(id)), { ok: false, message: safeError });
    assert.equal(bad.calls.some(([method]) => method === "from"), options.approved !== false);
    bad.unchanged();
  }
});

function ui(action) {
  const React = require("react");
  const states = [], refs = [];
  let si = 0, ri = 0;
  const { ParticipantQr } = load("../components/admin/participant-qr.tsx", {
    react: { ...React, useId: () => "qr-test", useState: (initial) => { const i = si++; if (!(i in states)) states[i] = initial; return [states[i], (value) => { states[i] = value; }]; }, useRef: (initial) => { const i = ri++; return refs[i] ??= { current: initial }; } },
    "@/app/admin/participants/qr-actions": { getParticipantQrAction: action },
  });
  const render = () => { si = 0; ri = 0; return ParticipantQr({ participant: { id, code: "EX001", full_name: "Ana" } }); };
  return { render, refs };
}
function nodes(tree, type) {
  if (!tree || typeof tree !== "object") return [];
  return [...(tree.type === type ? [tree] : []), ...[tree.props?.children].flat(Infinity).flatMap((child) => nodes(child, type))];
}
const html = (element) => require("react-dom/server").renderToStaticMarkup(element);

test("QR dialog loads only on explicit opening, displays link without navigation, and makes download explicit", async () => {
  let resolve, reads = 0;
  const f = ui(() => { reads++; return new Promise((done) => { resolve = done; }); });
  let tree = f.render();
  assert.equal(reads, 0);
  assert.doesNotMatch(html(tree), /data:image|asistencia\//);
  const dialog = nodes(tree, "dialog")[0];
  let opened = 0;
  dialog.props.ref.current = { showModal: () => { opened++; }, close: () => {} };
  const pending = nodes(tree, "button")[0].props.onClick();
  tree = f.render();
  assert.equal(opened, 1);
  assert.match(html(tree), /Cargando QR/);
  resolve({ ok: true, url, image: "data:image/png;base64,cG5n" });
  await pending;
  tree = f.render();
  const output = html(tree);
  assert.match(output, /aria-labelledby="qr-test-title"/);
  assert.match(output, /aria-describedby="qr-test-warning"/);
  assert.match(output, /registra la asistencia/);
  assert.match(output, /Descargar PNG/);
  assert.equal(nodes(tree, "input")[0].props.readOnly, true);
  assert.equal(nodes(tree, "input")[0].props.value, url);
  assert.equal(nodes(tree, "img")[0].props.src, "data:image/png;base64,cG5n");
  assert.deepEqual(nodes(tree, "a").map((node) => node.props.href), [`/admin/participants/${id}/qr`]);
  assert.equal(reads, 1);
  dialog.props.onClose();
  assert.doesNotMatch(html(f.render()), /data:image|asistencia\//);
});

test("QR dialog shows safe retryable errors and discards responses arriving after close", async () => {
  for (const action of [async () => ({ ok: false, message: safeError }), async () => { throw new Error(token); }]) {
    const f = ui(action);
    let tree = f.render();
    nodes(tree, "dialog")[0].props.ref.current = { showModal() {} };
    await nodes(tree, "button")[0].props.onClick();
    const output = html(f.render());
    assert.match(output, /role="alert"/);
    assert.ok(output.includes(safeError));
    assert.doesNotMatch(output, new RegExp(token));
  }
  let resolve;
  const f = ui(() => new Promise((done) => { resolve = done; }));
  const tree = f.render();
  const dialog = nodes(tree, "dialog")[0];
  dialog.props.ref.current = { showModal() {} };
  const pending = nodes(tree, "button")[0].props.onClick();
  dialog.props.onClose();
  resolve({ ok: true, url, image: "data:image/png;base64,cG5n" });
  await pending;
  assert.doesNotMatch(html(f.render()), /data:image|asistencia\//);
});

function copyUi(clipboard) {
  const React = require("react");
  const states = [], refs = [], logs = [];
  let si = 0, ri = 0;
  const { ParticipantAttendanceLink } = load("../components/admin/participant-attendance-link.tsx", {
    react: { ...React, useId: () => "link-test", useState: (initial) => { const i = si++; if (!(i in states)) states[i] = initial; return [states[i], (value) => { states[i] = value; }]; }, useRef: (initial) => { const i = ri++; return refs[i] ??= { current: initial }; } },
    navigator: { clipboard },
    console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
  });
  return {
    render: () => { si = 0; ri = 0; return ParticipantAttendanceLink({ participant: { code: "EX001", attendance_url: url } }); },
    logs,
  };
}

test("attendance link copies only on explicit request and announces pending and successful completion", async () => {
  const writes = [];
  let resolve;
  const f = copyUi({ writeText: (value) => { writes.push(value); return new Promise((done) => { resolve = done; }); } });
  let tree = f.render();
  assert.deepEqual(writes, []);
  assert.equal(nodes(tree, "a").length, 0);
  const input = nodes(tree, "input")[0];
  assert.equal(input.props.value, url);
  assert.equal(input.props.readOnly, true);
  assert.equal(nodes(tree, "label")[0].props.htmlFor, input.props.id);
  assert.match(html(tree), /EX001/);
  const button = nodes(tree, "button")[0];
  assert.equal(button.props.type, "button");
  assert.equal(button.props.disabled, false);
  assert.match(html(tree), /role="status"/);
  assert.doesNotMatch(html(tree), /Enlace copiado/);
  const pending = button.props.onClick();
  tree = f.render();
  assert.equal(nodes(tree, "button")[0].props.disabled, true);
  assert.match(html(tree), /Copiando/);
  assert.doesNotMatch(html(tree), /Enlace copiado/);
  assert.deepEqual(writes, [url]);
  resolve();
  await pending;
  tree = f.render();
  assert.equal(nodes(tree, "button")[0].props.disabled, false);
  const status = nodes(tree, "p").find((node) => node.props.role === "status");
  assert.equal(status.props.children, "Enlace copiado.");
  assert.equal(status.props["aria-live"], "polite");
  assert.equal(nodes(tree, "button")[0].props["aria-describedby"], status.props.id);
  assert.deepEqual(f.logs, []);
});

test("clipboard denial is safe, accessible and retryable without leaking the capability", async () => {
  let attempts = 0;
  const f = copyUi({ writeText: async (value) => {
    assert.equal(value, url);
    if (++attempts === 1) throw new Error(`private clipboard failure ${url}`);
  } });
  await nodes(f.render(), "button")[0].props.onClick();
  let tree = f.render();
  const status = nodes(tree, "p").find((node) => node.props.role === "status");
  assert.equal(status.props.children, "No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.");
  assert.doesNotMatch(html(status), /private|asistencia|Enlace copiado/);
  assert.equal(nodes(tree, "button")[0].props.disabled, false);
  assert.equal(nodes(tree, "input")[0].props.value, url);
  await nodes(tree, "button")[0].props.onClick();
  tree = f.render();
  assert.match(html(tree), /Enlace copiado/);
  assert.equal(attempts, 2);
  assert.deepEqual(f.logs, []);
});

test("unavailable clipboard provides manual-copy guidance instead of false success", async () => {
  for (const clipboard of [undefined, {}]) {
    const f = copyUi(clipboard);
    await nodes(f.render(), "button")[0].props.onClick();
    const tree = f.render();
    assert.match(html(tree), /No se pudo copiar el enlace/);
    assert.doesNotMatch(html(tree), /Enlace copiado/);
    assert.equal(nodes(tree, "input")[0].props.value, url);
    assert.deepEqual(f.logs, []);
  }
});

test("list retains responsive scrolling, existing actions and pagination while exposing a QR control per row", () => {
  const React = require("react");
  const { ParticipantList } = load("../components/admin/participant-list.tsx", {
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@/components/admin/participant-form": { ParticipantForm: () => "Edit form", DeleteParticipantForm: () => "Delete form" },
    "@/app/admin/participants/qr-actions": { getParticipantQrAction: async () => { throw new Error("Must not read while listing"); } },
  });
  const query = load("./participants/query.ts").parseParticipantQuery({ q: "Ana", page: "2" });
  const output = html(React.createElement(ParticipantList, { rows: [{ id, code: "EX001", full_name: "Ana", paid_amount: 0, attendance_state: "PENDIENTE", attended_at: null, attendance_url: url }], total: 41, query }));
  for (const text of ["Enlace QR", "Copiar enlace", url, "Ver QR", "overflow-x-auto", "Editar EX001: Ana", "Editar participante", "Delete form", "q=Ana", "page=3", "registra la asistencia"]) assert.ok(output.includes(text), text);
  assert.match(output, /<button[^>]*aria-haspopup="dialog"[^>]*>[\s\S]*?Editar EX001: Ana/);
  assert.match(output, /<dialog[^>]*aria-labelledby=/);
  assert.doesNotMatch(output, /Edit form/);
  assert.doesNotMatch(output, /href="https:\/\/canonical\.test\/asistencia\//);
  assert.match(output, /min-w-0/);
  assert.match(output, /w-64/);
});

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const token = "a".repeat(64);
const timestamp = "2026-03-13T02:15:30Z";
const recorded = { outcome: "recorded", full_name: "Ana Pérez", attended_at: timestamp };
const invalid = { outcome: "invalid", full_name: null, attended_at: null };
const error = { outcome: "error" };
function load(path, mocks = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } });
  const compiled = { exports: {} };
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports, Request, Response, URL, Intl, Date,
    fetch: mocks.fetch ?? (() => { throw new Error("Unexpected fetch"); }),
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
const malformed = ["", "a".repeat(63), "a".repeat(65), "A".repeat(64), ` ${token}`, `${token} `, `${token}\n`, `${token}?x=1`, "../admin", "á".repeat(64)];
function route(result) {
  const calls = [];
  const stored = { attended_at: null, writes: 0, sequence: 8 };
  const entry = load("../app/asistencia/[token]/registro/route.ts", {
    "@/lib/dal/attendance": { recordAttendance: async (value) => {
      calls.push(value);
      if (result instanceof Error) throw result;
      if (result) return result;
      const outcome = stored.attended_at ? "already_recorded" : "recorded";
      if (!stored.attended_at) { stored.attended_at = timestamp; stored.writes++; }
      return { ...recorded, outcome, token, paid_amount: 100, id: "private" };
    } },
  });
  const request = (headers = { origin: "https://attendance.test", "sec-fetch-site": "same-origin" }) => new Request(`https://attendance.test/asistencia/${token}/registro`, { method: "POST", headers });
  return { ...entry, calls, stored, request, send: (value = token, headers) => entry.POST(request(headers), { params: Promise.resolve({ token: value }) }) };
}
async function responseIs(response, status, body) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(await response.json(), body);
}

test("POST alone delegates exact tokens to atomic attendance and returns only safe fields, retaining original time", async () => {
  const f = route();
  await responseIs(await f.send(), 200, recorded);
  await responseIs(await f.send(), 200, { ...recorded, outcome: "already_recorded" });
  assert.deepEqual(f.calls, [token, token]);
  assert.deepEqual(f.stored, { attended_at: timestamp, writes: 1, sequence: 8 });
});

test("exact-origin POST accepts same-site metadata and retains the original attendance time", async () => {
  const f = route();
  const headers = { origin: "https://attendance.test", "sec-fetch-site": "same-site" };
  await responseIs(await f.send(token, headers), 200, recorded);
  await responseIs(await f.send(token, headers), 200, { ...recorded, outcome: "already_recorded" });
  assert.deepEqual(f.calls, [token, token]);
  assert.deepEqual(f.stored, { attended_at: timestamp, writes: 1, sequence: 8 });
});

test("missing-Origin POST accepts only same-context metadata and retains the original attendance time", async () => {
  for (const site of ["same-origin", "same-site"]) {
    const f = route();
    const headers = { "sec-fetch-site": site };
    await responseIs(await f.send(token, headers), 200, recorded);
    await responseIs(await f.send(token, headers), 200, { ...recorded, outcome: "already_recorded" });
    assert.deepEqual(f.calls, [token, token]);
    assert.deepEqual(f.stored, { attended_at: timestamp, writes: 1, sequence: 8 });
  }
});

test("malformed tokens are never normalized or passed to attendance", async () => {
  const f = route();
  for (const site of ["same-origin", "same-site"]) {
    for (const origin of [undefined, "https://attendance.test"]) {
      for (const value of [...malformed, null, 42]) {
        await responseIs(await f.send(value, { ...(origin === undefined ? {} : { origin }), "sec-fetch-site": site }), 404, invalid);
      }
    }
  }
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.stored, { attended_at: null, writes: 0, sequence: 8 });
});

test("POST fails closed on untrusted missing, opaque, foreign or contradictory origin, ignoring spoofed proxy headers", async () => {
  const f = route();
  for (const headers of [
    {},
    { origin: "null" },
    { origin: "https://evil.test" },
    { origin: "https://attendance.test.evil.test" },
    { origin: "http://attendance.test" },
    { origin: "https://attendance.test/" },
    ...["same-origin", "same-site"].flatMap((site) => ["", "null", "not-an-origin", "https://evil.test", "https://sub.attendance.test", "http://attendance.test", "https://attendance.test/"].map((origin) => ({
      origin, "sec-fetch-site": site,
    }))),
    ...[undefined, "https://attendance.test"].flatMap((origin) => ["cross-site", "none", "", "unexpected"].map((site) => ({
      ...(origin === undefined ? {} : { origin }), "sec-fetch-site": site,
    }))),
    { "x-forwarded-host": "attendance.test", "x-forwarded-proto": "https" },
    { origin: "https://evil.test", host: "attendance.test", "x-forwarded-host": "evil.test" },
  ]) {
    await responseIs(await f.send(token, headers), 403, error);
  }
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.stored, { attended_at: null, writes: 0, sequence: 8 });
  await responseIs(await f.send(token, { origin: "https://attendance.test" }), 200, recorded);
});

test("POST uses the browser Host rather than Next's normalized URL, preserving the exact port and scheme", async () => {
  const f = route();
  for (const [url, host, origin] of [
    ["http://localhost:43127", "127.0.0.1:43127", "http://127.0.0.1:43127"],
    ["https://localhost:43127", "attendance.test", "https://attendance.test"],
    ["https://attendance.test", "attendance.test", "https://attendance.test"],
  ]) {
    const response = await f.POST(new Request(`${url}/asistencia/${token}/registro`, {
      method: "POST", headers: { host, origin, "sec-fetch-site": "same-origin" },
    }), { params: Promise.resolve({ token: "malformed" }) });
    await responseIs(response, 404, invalid);
  }
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.stored, { attended_at: null, writes: 0, sequence: 8 });
});

test("POST rejects origins contradicting Host even when they match the normalized URL or forwarded host", async () => {
  const f = route();
  for (const headers of [
    { host: "foreign.test", origin: "https://attendance.test" },
    { host: "attendance.test:444", origin: "https://attendance.test" },
    { host: "attendance.test", origin: "http://attendance.test" },
    { host: "attendance.test", origin: "https://foreign.test", "x-forwarded-host": "foreign.test" },
    { host: "attendance.test", origin: "https://attendance.test/" },
    { host: "attendance.test/path", origin: "https://attendance.test/path" },
    { host: "user@attendance.test", origin: "https://user@attendance.test" },
    { host: "", origin: "https://attendance.test" },
  ]) {
    for (const site of ["same-origin", "same-site"]) {
      await responseIs(await f.send(token, { ...headers, "sec-fetch-site": site }), 403, error);
    }
  }
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.stored, { attended_at: null, writes: 0, sequence: 8 });
});

test("invalid and provider/malformed-result errors are private and never disclose identity or provider details", async () => {
  for (const headers of [
    { origin: "https://attendance.test", "sec-fetch-site": "same-origin" },
    { "sec-fetch-site": "same-origin" },
    { "sec-fetch-site": "same-site" },
  ]) {
    await responseIs(await route({ ...invalid, full_name: "Private name", token }).send(token, headers), 404, invalid);
    for (const value of [new Error(`private ${token}`), {}, { ...recorded, attended_at: "bad" }, { ...recorded, full_name: "" }]) {
      await responseIs(await route(value).send(token, headers), 503, error);
    }
  }
});

test("unsupported methods including GET, HEAD and preflight never register and remain private without CORS", async () => {
  const f = route();
  for (const method of ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "DELETE"]) {
    for (const headers of [{}, { "sec-fetch-site": "same-origin" }, { "sec-fetch-site": "same-site" }]) {
      const response = await f[method](new Request(`https://attendance.test/asistencia/${token}/registro`, { method, headers }));
      assert.equal(response.status, 405);
      assert.equal(response.headers.get("allow"), "POST");
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("access-control-allow-origin"), null);
      assert.equal(await response.text(), "");
    }
  }
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.stored, { attended_at: null, writes: 0, sequence: 8 });
});

const html = (tree) => require("react-dom/server").renderToStaticMarkup(tree);
function nodes(tree, type) {
  if (!tree || typeof tree !== "object") return [];
  if (typeof tree.type === "function") return nodes(tree.type(tree.props), type);
  return [...(tree.type === type ? [tree] : []), ...[tree.props?.children].flat(Infinity).flatMap((child) => nodes(child, type))];
}
function client(fetcher, value = token) {
  const React = require("react");
  const states = [], refs = [], effects = [];
  let si = 0, ri = 0;
  const { AttendanceRegistration } = load("../components/attendance/attendance-registration.tsx", {
    fetch: fetcher,
    "@/components/ui/button": { Button: "button" },
    react: { ...React,
      useState(initial) { const i = si++; if (!(i in states)) states[i] = initial; return [states[i], (value) => { states[i] = value; }]; },
      useRef(initial) { const i = ri++; return refs[i] ??= { current: initial }; },
      useEffect(effect) { effects.push(effect); },
    },
  });
  return { effects, render() { si = 0; ri = 0; return AttendanceRegistration({ token: value }); } };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("ordered headers keep pages strict-origin and override registration endpoints to no-referrer", async () => {
  const config = load("../../next.config.ts").default;
  assert.equal(config.poweredByHeader, false);
  assert.deepEqual(json(config.allowedDevOrigins), ["192.168.3.158"]);
  assert.deepEqual(json(await config.headers()), [{
    source: "/:path*",
    headers: [
      { key: "Referrer-Policy", value: "strict-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
    ],
  }, {
    source: "/asistencia/:token/registro",
    headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
  }]);
});

test("GET/render stays neutral and dynamic with strict-origin, no RPC, and a visible automatic/shared-link warning", async () => {
  let calls = 0;
  const React = require("react");
  const page = load("../app/asistencia/[token]/page.tsx", {
    "@/components/attendance/attendance-registration": { AttendanceRegistration: () => React.createElement("p", null, "Registrando asistencia…") },
    "@/lib/dal/attendance": { recordAttendance: () => { calls++; } },
  });
  assert.equal(page.dynamic, "force-dynamic");
  assert.equal(page.metadata.referrer, "strict-origin");
  assert.equal(page.metadata.robots.index, false);
  const output = html(await page.default({ params: Promise.resolve({ token }) }));
  assert.match(output, /Abrir este enlace registra tu asistencia/);
  assert.match(output, /compartes.*otra persona.*registrar/s);
  assert.doesNotMatch(output, new RegExp(`${token}|Ana Pérez`));
  assert.equal(calls, 0);
  const f = client(() => { calls++; });
  assert.match(html(f.render()), /Registrando asistencia/);
  assert.equal(calls, 0);
});

test("hydration automatically POSTs same-origin with strict-origin and no body, deduplicates effect replay, and shows recorded name/Lima time", async () => {
  const calls = [];
  const f = client(async (...args) => { calls.push(args); return Response.json(recorded); });
  f.render();
  const cleanup = f.effects[0]();
  cleanup();
  f.effects[0]();
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], `/asistencia/${token}/registro`);
  assert.deepEqual(json(calls[0][1]), { method: "POST", mode: "same-origin", credentials: "same-origin", cache: "no-store", referrerPolicy: "strict-origin", redirect: "error" });
  const output = html(f.render());
  assert.match(output, /Asistencia registrada/);
  assert.match(output, /Ana Pérez/);
  assert.match(output, /12\/03\/2026.*21:15:30/);
  assert.match(output, /Lima/);
  assert.match(output, /role="status"/);
});

test("already recorded displays original Lima time; invalid input/result never exposes names or calls for malformed tokens", async () => {
  const existing = client(async () => Response.json({ ...recorded, outcome: "already_recorded" }));
  existing.render(); existing.effects[0](); await settle();
  const output = html(existing.render());
  assert.match(output, /Tu ingreso ya fue registrado/);
  assert.match(output, /Ana Pérez/);
  assert.match(output, /12\/03\/2026.*21:15:30/);
  assert.match(output, /original/);
  for (const value of [...malformed, token]) {
    let calls = 0;
    const f = client(async () => { calls++; return Response.json({ ...invalid, full_name: "Private name" }, { status: 404 }); }, value);
    f.render(); f.effects[0](); await settle();
    const output = html(f.render());
    assert.match(output, /Enlace no válido/);
    assert.match(output, /role="alert"/);
    assert.doesNotMatch(output, /Private name|Ana Pérez/);
    assert.equal(calls, value === token ? 1 : 0);
  }
});

test("safe error offers accessible retry, keeps loading distinct, and ignores results after unmount", async () => {
  for (const failure of [async () => { throw new Error(token); }, async () => Response.json({ ...recorded, message: token }, { status: 503 }), async () => Response.json({ ...recorded, attended_at: "bad" }), async () => new Response("not json")]) {
    let calls = 0;
    const f = client(async () => { calls++; return calls === 1 ? failure() : Response.json(recorded); });
    f.render(); f.effects[0](); await settle();
    let tree = f.render();
    const output = html(tree);
    assert.match(output, /role="alert"/);
    assert.match(output, /No pudimos confirmar/);
    assert.doesNotMatch(output, new RegExp(`${token}|Ana Pérez`));
    const button = nodes(tree, "button")[0];
    assert.equal(button.props.children, "Reintentar registro");
    const pending = button.props.onClick();
    assert.match(html(f.render()), /Registrando asistencia/);
    await pending; await settle();
    tree = f.render();
    assert.match(html(tree), /Asistencia registrada/);
    assert.equal(calls, 2);
  }
  let resolve;
  const f = client(() => new Promise((done) => { resolve = done; }));
  f.render(); const cleanup = f.effects[0](); cleanup();
  resolve(Response.json(recorded)); await settle();
  assert.doesNotMatch(html(f.render()), /Ana Pérez/);
});

test("result view wraps long names, escapes markup and keeps an accessible narrow-screen layout", () => {
  const { AttendanceStatus } = load("../components/attendance/attendance-status.tsx");
  const output = html(require("react").createElement(AttendanceStatus, { result: { ...recorded, full_name: `<script>${"Nombre".repeat(50)}</script>` }, onRetry() {} }));
  assert.match(output, /break-words/);
  assert.match(output, /min-w-0/);
  assert.match(output, /&lt;script&gt;/);
  assert.doesNotMatch(output, /<script>/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, mocks, env = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const compiled = { exports: {} };
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports, process: { env }, URL,
    console: mocks.console ?? console,
    require(name) {
      if (name === "server-only") return {};
      if (name in mocks) return mocks[name];
      if (name.startsWith("@/")) return load(`../${name.slice(2)}.ts`, mocks, env);
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return compiled.exports;
}

function adminClient({ user = { id: "admin-id" }, authError = null, member = true, dbError = null } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    from(table) {
      calls.push(table);
      return { select: () => ({ eq: (column, value) => {
        calls.push([column, value]);
        return { maybeSingle: async () => ({ data: member ? { user_id: "admin-id" } : null, error: dbError }) };
      } }) };
    },
  };
  return { client, calls };
}

for (const [label, options] of [
  ["missing session", { user: null }],
  ["unverified identity", { authError: {} }],
  ["unapproved authenticated user", { member: false }],
  ["mismatched administrator ID", { user: { id: "other-id" } }],
  ["membership query failure", { dbError: {} }],
]) {
  test(`admin DAL rejects ${label}`, async () => {
    const { client, calls } = adminClient(options);
    const { requireAdmin } = load("./dal/admin.ts", {
      "@/lib/supabase/server": { createClient: async () => client },
    });
    await assert.rejects(requireAdmin(), { message: "Acceso administrativo no autorizado." });
    assert.equal(calls.includes("participants"), false);
    if (options.user === null || options.authError) assert.equal(calls.length, 0);
  });
}

test("admin DAL hides thrown provider errors and fails closed", async () => {
  const { client, calls } = adminClient();
  client.auth.getUser = async () => { throw new Error("private provider detail"); };
  const { requireAdmin } = load("./dal/admin.ts", {
    "@/lib/supabase/server": { createClient: async () => client },
  });
  await assert.rejects(requireAdmin(), { message: "Acceso administrativo no autorizado." });
  assert.equal(calls.length, 0);
});

test("admin DAL returns the user-scoped client only for approved membership", async () => {
  const { client, calls } = adminClient();
  const { requireAdmin } = load("./dal/admin.ts", {
    "@/lib/supabase/server": { createClient: async () => client },
  });
  const result = await requireAdmin();
  assert.equal(result.supabase, client);
  assert.equal(result.user.id, "admin-id");
  assert.deepEqual(calls, ["approved_administrators", ["user_id", "admin-id"]]);
});

const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test-key",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};
const secretKey = "sb_secret_test-key_123";

function attendance(data, error = null, env = { SUPABASE_SECRET_KEY: secretKey }) {
  const calls = [];
  const dal = load("./dal/attendance.ts", {
    "@supabase/supabase-js": { createClient: (url, key, options) => {
      calls.push({ url, key, options });
      return { rpc: async (name, args) => {
        calls.push({ name, args });
        return { data, error };
      } };
    } },
  }, { ...publicEnv, ...env });
  return { ...dal, calls };
}
const token = "a".repeat(64);

test("attendance rejects malformed tokens without constructing a privileged client", async () => {
  const dal = attendance([]);
  for (const invalid of [null, undefined, 1, "", "a".repeat(63), "a".repeat(65), "A".repeat(64), ` ${token}`, "../../admin"]) {
    assert.equal((await dal.recordAttendance(invalid)).outcome, "invalid");
  }
  assert.equal(dal.calls.length, 0);
});

for (const outcome of ["recorded", "already_recorded", "invalid"]) {
  test(`attendance returns only safe fields for ${outcome}`, async () => {
    const full_name = outcome === "invalid" ? null : "Ana Pérez";
    const attended_at = outcome === "invalid" ? null : "2026-03-13T12:00:00+00:00";
    const dal = attendance([{ outcome, full_name, attended_at, token, paid_amount: 100, id: "private" }]);
    const result = await dal.recordAttendance(token);
    assert.equal(JSON.stringify(result), JSON.stringify({ outcome, full_name, attended_at }));
    assert.equal(dal.calls.length, 2);
    assert.equal(dal.calls[0].url, publicEnv.NEXT_PUBLIC_SUPABASE_URL);
    assert.equal(dal.calls[0].key, secretKey);
    assert.equal(JSON.stringify(dal.calls[0].options.auth), JSON.stringify({
      persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
    }));
    assert.equal(dal.calls[1].name, "record_attendance");
    assert.equal(dal.calls[1].args.attendance_token, token);
  });
}

for (const [label, data, error] of [
  ["provider failure", null, { message: "private provider detail" }],
  ["empty response", [], null],
  ["ambiguous multi-row response", Array.from({ length: 2 }, () => ({
    outcome: "recorded", full_name: "Ana Pérez", attended_at: "2026-03-13T12:00:00+00:00",
  })), null],
  ["invalid outcome", [{ outcome: "private", full_name: null, attended_at: null }], null],
  ["inconsistent result", [{ outcome: "recorded", full_name: null, attended_at: null }], null],
]) {
  test(`attendance fails safely on ${label}`, async () => {
    const dal = attendance(data, error);
    await assert.rejects(dal.recordAttendance(token), { message: "No se pudo registrar la asistencia." });
  });
}

for (const [label, env] of [
  ["missing secret", {}],
  ["empty secret", { SUPABASE_SECRET_KEY: "   " }],
  ["placeholder secret", { SUPABASE_SECRET_KEY: "sb_secret_REPLACE_ME" }],
  ["example project secret", { SUPABASE_SECRET_KEY: "sb_secret_your-project" }],
  ["publishable key", { SUPABASE_SECRET_KEY: "sb_publishable_test-key" }],
  ["legacy JWT in modern variable", { SUPABASE_SECRET_KEY: "eyJhbGciOiJIUzI1NiJ9.payload.signature" }],
  ["missing secret suffix", { SUPABASE_SECRET_KEY: "sb_secret_" }],
  ["invalid secret characters", { SUPABASE_SECRET_KEY: "sb_secret_key/invalid" }],
  ["legacy variable alone", { SUPABASE_SERVICE_ROLE_KEY: "legacy-private-key" }],
  ["invalid modern key despite legacy variable", {
    SUPABASE_SECRET_KEY: "invalid", SUPABASE_SERVICE_ROLE_KEY: "legacy-private-key",
  }],
]) {
  test(`attendance fails safely on ${label} without constructing a client or calling RPC`, async () => {
    const dal = attendance([], null, env);
    await assert.rejects(dal.recordAttendance(token), { message: "No se pudo registrar la asistencia." });
    assert.equal(dal.calls.length, 0);
  });
}

test("attendance trims the modern secret and ignores the legacy variable", async () => {
  const dal = attendance([{ outcome: "invalid", full_name: null, attended_at: null }], null, {
    SUPABASE_SECRET_KEY: `  ${secretKey}  `,
    SUPABASE_SERVICE_ROLE_KEY: "legacy-private-key",
  });
  assert.equal(JSON.stringify(await dal.recordAttendance(token)), JSON.stringify({
    outcome: "invalid", full_name: null, attended_at: null,
  }));
  assert.equal(dal.calls.length, 2);
  assert.equal(dal.calls[0].key, secretKey);
  assert.equal(dal.calls[1].name, "record_attendance");
  assert.equal(dal.calls[1].args.attendance_token, token);
});

test("public environment preserves publishable configuration without exposing server credentials", () => {
  const { getSupabaseEnv, getSiteUrl } = load("./env.ts", {}, {
    ...publicEnv, SUPABASE_SECRET_KEY: secretKey, SUPABASE_SERVICE_ROLE_KEY: "legacy-private-key",
  });
  assert.equal(JSON.stringify(getSupabaseEnv()), JSON.stringify({
    url: publicEnv.NEXT_PUBLIC_SUPABASE_URL, key: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }));
  assert.equal(getSiteUrl(), publicEnv.NEXT_PUBLIC_SITE_URL);
  const envSource = readFileSync(new URL("./env.ts", import.meta.url), "utf8");
  assert.doesNotMatch(envSource, /process\.env\.SUPABASE_(SECRET|SERVICE_ROLE)_KEY/);
  const dalSource = readFileSync(new URL("./dal/attendance.ts", import.meta.url), "utf8");
  assert.match(dalSource, /^import "server-only";/);
});

for (const key of [secretKey, "eyJhbGciOiJIUzI1NiJ9.payload.signature", "sb_publishable_"]) {
  test(`public environment rejects non-publishable configuration: ${key.split("_")[1] ?? "JWT"}`, () => {
    const { getSupabaseEnv } = load("./env.ts", {}, {
      ...publicEnv, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    });
    assert.throws(getSupabaseEnv, { message: "Configura una variable válida: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." });
  });
}

function proxyFixture(options = {}) {
  const { client } = adminClient(options);
  let cookieAdapter;
  client.auth.getUser = async () => {
    cookieAdapter.setAll([{ name: "refreshed", value: "cookie", options: { httpOnly: true } }]);
    return { data: { user: options.user === null ? null : { id: "admin-id" } }, error: options.authError ?? null };
  };
  const response = (status, location) => ({
    status, location, headers: new Map(),
    cookies: {
      values: [],
      set(name, value, options) {
        this.values.push(typeof name === "object" ? name : { name, value, ...options });
      },
      getAll() { return this.values; },
    },
  });
  const dal = load("../proxy.ts", {
    "@/lib/env": { getSupabaseEnv: () => ({ url: "https://example.supabase.co", key: "public" }) },
    "@supabase/ssr": { createServerClient: (_url, _key, config) => {
      cookieAdapter = config.cookies;
      return client;
    } },
    "next/server": { NextResponse: {
      next: () => response(200),
      redirect: (url, status = 307) => response(status, url.pathname + url.search),
    } },
  });
  const request = {
    url: "https://attendance.test/admin/participants?secret=ignored",
    nextUrl: new URL("https://attendance.test/admin/participants?secret=ignored"),
    cookies: { getAll: () => [], set() {} },
  };
  return { ...dal, request };
}

for (const [label, options, status, location] of [
  ["unauthenticated", { user: null }, 307, "/login"],
  ["auth error despite a returned user", { authError: { message: "private provider detail" } }, 307, "/login"],
  ["unapproved", { member: false }, 307, "/login?status=unauthorized"],
  ["approved", {}, 200, undefined],
  ["membership failure", { dbError: {} }, 307, "/login?status=unauthorized"],
]) {
  test(`proxy protects nested admin route for ${label} and preserves refresh cookies`, async () => {
    const { proxy, request } = proxyFixture(options);
    const result = await proxy(request);
    assert.equal(result.status, status);
    assert.equal(result.location, location);
    assert.equal(result.cookies.values[0].name, "refreshed");
    assert.equal(result.cookies.values[0].httpOnly, true);
    assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  });
}

test("existing SSR factory keeps per-request cookies and tolerates read-only Server Components", async () => {
  const sets = [];
  let config;
  const { createClient } = load("./supabase/server.ts", {
    "@/lib/env": { getSupabaseEnv: () => ({ url: "https://example.supabase.co", key: "public" }) },
    "next/headers": { cookies: async () => ({
      getAll: () => [{ name: "session", value: "user-session" }],
      set: (...args) => { sets.push(args); throw new Error("Read-only cookies"); },
    }) },
    "@supabase/ssr": { createServerClient: (_url, _key, options) => { config = options; return {}; } },
  });
  const first = await createClient();
  const second = await createClient();
  assert.notEqual(first, second);
  assert.equal(config.cookies.getAll()[0].value, "user-session");
  assert.doesNotThrow(() => config.cookies.setAll([{ name: "session", value: "refresh", options: {} }]));
  assert.equal(sets[0][1], "refresh");
});

const loginFailure = { status: "error", message: "No se pudo iniciar sesión. Revisa tus credenciales o contacta al administrador." };

function loginFixture({ error = null, throws = false, factoryThrows = false, user = { id: "admin-id" }, session = { access_token: "private-session" } } = {}) {
  const calls = [];
  const cookies = [];
  const logs = [];
  let clients = 0;
  const action = load("../app/login/actions.ts", {
    console: Object.fromEntries(["log", "info", "warn", "error", "debug"].map((method) => [method, (...args) => logs.push(args)])),
    "@/lib/env": { getSupabaseEnv: () => ({ url: "https://example.supabase.co", key: "public" }) },
    "next/headers": { cookies: async () => {
      if (factoryThrows) throw new Error("private configuration detail");
      return { getAll: () => [{ name: "existing", value: "existing-session" }], set: (...args) => cookies.push(args) };
    } },
    "@supabase/ssr": { createServerClient: (_url, _key, config) => {
      clients += 1;
      return { auth: { signInWithPassword: async (credentials) => {
        calls.push(JSON.parse(JSON.stringify(credentials)));
        assert.equal(config.cookies.getAll()[0].value, "existing-session");
        if (throws) throw new Error("private provider detail");
        if (!error && user && session) config.cookies.setAll([{ name: "session", value: "private-session", options: { httpOnly: true, secure: true } }]);
        return { data: { user, session }, error };
      } } };
    } },
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
  });
  return { ...action, calls, cookies, logs, clients: () => clients };
}

const previousLoginState = { status: "idle", message: "" };
function credentials(email = "admin@example.com", password = "correct-password") {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  return form;
}

for (const [label, email, password] of [
  ["missing email", null, "secret"], ["malformed email", "admin@invalid", "secret"],
  ["oversized email", `${"a".repeat(243)}@example.com`, "secret"],
  ["file email", new Blob(["private"]), "secret"], ["missing password", "admin@example.com", null],
  ["empty password", "admin@example.com", ""], ["file password", "admin@example.com", new Blob(["private"])],
]) {
  test(`password login rejects ${label} before contacting Auth or changing cookies`, async () => {
    const f = loginFixture();
    const form = credentials();
    if (email === null) form.delete("email"); else form.set("email", email);
    if (password === null) form.delete("password"); else form.set("password", password);
    assert.equal(JSON.stringify(await f.signIn(previousLoginState, form)), JSON.stringify(loginFailure));
    assert.equal(f.clients(), 0);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.cookies, []);
    assert.deepEqual(f.logs, []);
  });
}

for (const [label, options] of [
  ["unknown account", { error: { message: "user not found" } }],
  ["wrong password", { error: { message: "invalid password" } }],
  ["unconfirmed email", { error: { message: "email not confirmed" } }],
  ["rate limit", { error: { message: "too many attempts" } }],
  ["transport failure", { throws: true }], ["configuration failure", { factoryThrows: true }],
  ["missing user", { user: null }], ["missing session", { session: null }],
]) {
  test(`password login gives the same neutral failure for ${label}`, async () => {
    const f = loginFixture(options);
    assert.equal(JSON.stringify(await f.signIn(previousLoginState, credentials())), JSON.stringify(loginFailure));
    assert.equal(f.clients(), options.factoryThrows ? 0 : 1);
    assert.deepEqual(f.calls, options.factoryThrows ? [] : [{ email: "admin@example.com", password: "correct-password" }]);
    assert.deepEqual(f.cookies, []);
    assert.deepEqual(f.logs, []);
  });
}

test("password login trims only email, preserves password bytes and SSR cookies, and redirects locally", async () => {
  const f = loginFixture();
  const form = credentials("  admin@example.com  ", "  secret password  ");
  form.set("next", "https://evil.test");
  form.set("redirect_to", "//evil.test");
  await assert.rejects(f.signIn(previousLoginState, form), { message: "redirect:/admin" });
  assert.deepEqual(f.calls, [{ email: "admin@example.com", password: "  secret password  " }]);
  assert.deepEqual(f.cookies, [["session", "private-session", { httpOnly: true, secure: true }]]);
  assert.equal(f.clients(), 1);
  assert.deepEqual(f.logs, []);
});

test("login returns only to an exact attendance token and rejects redirect injection", async () => {
  for (const value of ["a".repeat(64), "//evil.test", "A".repeat(64), "a".repeat(64) + "?x=1"]) {
    const form = credentials();
    form.set("attendance_token", value);
    const target = value === "a".repeat(64) ? `/asistencia/${value}` : "/admin";
    await assert.rejects(loginFixture().signIn(previousLoginState, form), { message: `redirect:${target}` });
  }
});

function authViewMocks() {
  const jsx = (type, props) => ({ type, props });
  return {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/components/ui/card": { Card: "card" },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/input": { Input: "input" },
    "next/link": { default: "link" },
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    "@/components/auth/login-form": { LoginForm: "login-form" },
  };
}

function viewNodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(viewNodes);
  return [node, ...viewNodes(node.props?.children)];
}

test("login form visibility toggle retains token and respects unavailable and pending states", () => {
  for (const pending of [false, true]) for (const disabled of [false, true]) {
    let visible = false;
    const { LoginForm } = load("../components/auth/login-form.tsx", {
      ...authViewMocks(), "@/app/login/actions": { signIn() {} },
      react: { useActionState: () => [loginFailure, "action", pending], useState: () => [visible, (update) => { visible = update(visible); }] },
    });
    const render = () => viewNodes(LoginForm({ disabled, attendanceToken: token }));
    let nodes = render();
    assert.equal(nodes.find((n) => n.props?.name === "attendance_token").props.value, token);
    let toggle = nodes.find((n) => n.props?.["aria-pressed"] !== undefined);
    assert.equal(toggle.props.type, "button");
    assert.equal(toggle.props.disabled, pending || disabled);
    assert.equal(toggle.props["aria-pressed"], false);
    assert.ok(toggle.props["aria-label"]);
    if (!pending && !disabled) {
      toggle.props.onClick();
      nodes = render();
      toggle = nodes.find((n) => n.props?.["aria-pressed"] !== undefined);
      assert.equal(toggle.props["aria-pressed"], true);
      assert.equal(nodes.find((n) => n.props?.name === "password").props.type, "text");
      toggle.props.onClick();
      assert.equal(render().find((n) => n.props?.name === "password").props.type, "password");
    }
  }
});

test("login shell has isolated responsive layout", async () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /body:has\(\.login-screen\)\s*>\s*header/);
  assert.match(css, /body:has\(\.login-screen\)\s*>\s*main#contenido/);
  assert.match(css, /@media\s*\(min-width:\s*640px\)/);
  assert.match(css, /\.login-notice/);
  assert.doesNotMatch(css, /\.login-(?:welcome|notice)\s*\{[^}]*position:\s*absolute/);
  assert.doesNotMatch(css, /\.login-(?:card|card-label)\s*\{[^}]*margin-bottom:\s*(?:6\.5|8)rem/);
  assert.match(css, /\.login-screen\s+\.login-card\s*\{[^}]*display:\s*contents/);
  const { client } = adminClient({ user: null });
  const { default: LoginPage } = load("../app/login/page.tsx", {
    ...authViewMocks(), "@/lib/supabase/server": { createClient: async () => client },
  });
  const nodes = viewNodes(await LoginPage({ searchParams: Promise.resolve({}) }));
  const card = nodes.find((n) => n.type === "card");
  const children = Array.from(card.props.children).filter(Boolean);
  assert.deepEqual(children.map((n) => n.props.className), ["login-card-label", "login-welcome", "login-body", "login-notice"]);
  assert.equal(viewNodes(children[1]).filter((n) => n.type === "h1").length, 1);
  assert.equal(viewNodes(children[2]).filter((n) => n.type === "login-form").length, 1);
});

test("login form offers email/password only, disables both while pending, and shows safe action feedback", () => {
  for (const pending of [false, true]) {
    const { LoginForm } = load("../components/auth/login-form.tsx", {
      ...authViewMocks(),
      "@/app/login/actions": { signIn() {} },
      react: { useActionState: () => [loginFailure, "action", pending], useState: (initial) => [initial, () => {}] },
    });
    const view = LoginForm({});
    const nodes = viewNodes(view);
    const inputs = nodes.filter((node) => node.type === "input");
    assert.equal(inputs.length, 2);
    assert.deepEqual(inputs.map(({ props }) => [props.name, props.type, props.autoComplete, props.required, props.disabled]), [
      ["email", "email", "username", true, pending], ["password", "password", "current-password", true, pending],
    ]);
    const output = JSON.stringify(view);
    assert.match(output, /Iniciar sesión|Ingresando/);
    assert.match(output, /Revisa tus credenciales/);
    assert.doesNotMatch(output, /Magic|Solicitando enlace|Enviar enlace|resetPassword|signUp/);
    const disabledView = JSON.stringify(LoginForm({ disabled: true }));
    assert.doesNotMatch(disabledView, /"disabled":false/);
  }
});

for (const approved of [false, true]) {
  test(`login page reflects independent administrator approval (${approved}) without stale link flows`, async () => {
    const { client, calls } = adminClient({ member: approved });
    const { default: LoginPage } = load("../app/login/page.tsx", {
      ...authViewMocks(),
      "@/lib/supabase/server": { createClient: async () => client },
    });
    const output = JSON.stringify(await LoginPage({ searchParams: Promise.resolve({ status: "link-error" }) }));
    assert.deepEqual(calls, ["approved_administrators", ["user_id", "admin-id"]]);
    assert.equal(output.includes('"href":"/admin"'), approved);
    assert.match(output, /contraseña/);
    assert.match(output, /No hay registro público ni recuperación de contraseña/);
    assert.doesNotMatch(output, /todavía está en desarrollo|Solicita uno nuevo|Recibe un enlace/);
  });
}

test("login returns approved sessions to the QR and keeps unapproved sessions on the form", async () => {
  const token = "a".repeat(64);
  for (const approved of [false, true]) {
    const { client } = adminClient({ member: approved });
    const { default: LoginPage } = load("../app/login/page.tsx", {
      ...authViewMocks(), "@/lib/supabase/server": { createClient: async () => client },
    });
    const result = LoginPage({ searchParams: Promise.resolve({ attendance_token: token }) });
    if (approved) await assert.rejects(result, { message: `redirect:/asistencia/${token}` });
    else assert.match(JSON.stringify(await result), new RegExp(token));
  }
});

function confirmationFixture({ error = null, throws = false, factoryThrows = false } = {}) {
  const calls = [];
  const cookieWrites = [];
  const logs = [];
  let clients = 0;
  const route = load("../app/auth/confirm/route.ts", {
    console: Object.fromEntries(["log", "info", "warn", "error", "debug"].map((method) => [method, (...args) => logs.push(args)])),
    "@/lib/env": { getSupabaseEnv: () => ({ url: "https://example.supabase.co", key: "public" }) },
    "next/headers": { cookies: async () => {
      if (factoryThrows) throw new Error("private configuration detail");
      return {
        getAll: () => [{ name: "pkce-verifier", value: "private-verifier" }],
        set: (...args) => cookieWrites.push(args),
      };
    } },
    "@supabase/ssr": { createServerClient: (_url, _key, config) => {
      clients += 1;
      async function authenticate(method, input) {
        calls.push([method, input]);
        assert.equal(config.cookies.getAll()[0].value, "private-verifier");
        if (throws) throw new Error("private provider detail");
        if (!error) config.cookies.setAll([{ name: "session", value: "private-session", options: { httpOnly: true } }]);
        return { error };
      }
      return { auth: {
        exchangeCodeForSession: (code) => authenticate("exchange", code),
        verifyOtp: (input) => authenticate("verify", input),
      } };
    } },
    "next/server": { NextResponse: { redirect: (url, status) => new Response(null, {
      status, headers: { Location: url.toString() },
    }) } },
  });
  return { ...route, calls, cookieWrites, logs, clients: () => clients };
}

async function confirm(fixture, query) {
  const url = new URL(`http://localhost:3000/auth/confirm?${query}`);
  const response = await fixture.GET({ url: url.toString(), nextUrl: url });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "http://localhost:3000/login");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(await response.text(), "");
  assert.deepEqual(fixture.logs, []);
  assert.deepEqual(fixture.cookieWrites, []);
}

for (const query of ["", "code=private-code", "token_hash=private-hash&type=email", "token_hash=private-hash&type=magiclink", "token_hash=private-hash&type=recovery", "code=private-code&token_hash=private-hash&type=email", "error=access_denied&error_description=private-detail"]) {
  test(`retired auth callback ignores credentials without creating a session: ${query || "empty query"}`, async () => {
    const fixture = confirmationFixture();
    await confirm(fixture, `${query}&next=https://evil.test&redirect_to=//evil.test`);
    assert.deepEqual(fixture.calls, []);
    assert.equal(fixture.clients(), 0);
  });
}

const signOutFailure = { status: "error", message: "No se pudo cerrar sesión. Inténtalo de nuevo." };

function signOutFixture({ error = null, throws = false, factoryThrows = false, ...adminOptions } = {}) {
  const { client, calls: membershipCalls } = adminClient(adminOptions);
  const calls = [];
  const cookieWrites = [];
  const logs = [];
  let clients = 0;
  const action = load("../app/admin/actions.ts", {
    console: Object.fromEntries(["log", "info", "warn", "error", "debug"].map((method) => [method, (...args) => logs.push(args)])),
    "@/lib/env": { getSupabaseEnv: () => ({ url: "https://example.supabase.co", key: "public" }) },
    "next/headers": { cookies: async () => {
      if (factoryThrows) throw new Error("private configuration detail");
      return {
        getAll: () => [{ name: "session", value: "private-session" }],
        set: (...args) => cookieWrites.push(args),
      };
    } },
    "@supabase/ssr": { createServerClient: (_url, _key, config) => {
      clients += 1;
      client.auth.signOut = async (...args) => {
        calls.push(JSON.parse(JSON.stringify(args)));
        assert.equal(config.cookies.getAll()[0].value, "private-session");
        if (throws) throw new Error("private provider detail");
        if (!error) config.cookies.setAll([
          { name: "session.0", value: "", options: { maxAge: 0, path: "/", httpOnly: true, secure: true, sameSite: "lax" } },
          { name: "session.1", value: "", options: { maxAge: 0, path: "/", httpOnly: true, secure: true, sameSite: "lax" } },
        ]);
        return { error };
      };
      return client;
    } },
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
  });
  return { ...action, calls, membershipCalls, cookieWrites, logs, clients: () => clients };
}

test("admin sign-out uses the approved SSR client, expires session cookies and redirects only to login", async () => {
  const f = signOutFixture();
  const form = new FormData();
  form.set("next", "https://evil.test");
  form.set("redirect_to", "//evil.test");
  await assert.rejects(f.signOutAction({ status: "idle", message: "" }, form), { message: "redirect:/login" });
  assert.deepEqual(f.calls, [[{ scope: "local" }]]);
  assert.equal(f.clients(), 1);
  assert.deepEqual(f.membershipCalls, ["approved_administrators", ["user_id", "admin-id"]]);
  assert.deepEqual(f.cookieWrites, ["session.0", "session.1"].map((name) => [name, "", {
    maxAge: 0, path: "/", httpOnly: true, secure: true, sameSite: "lax",
  }]));
  assert.deepEqual(f.logs, []);
});

for (const [label, options, contacted] of [
  ["provider error", { error: { message: "private provider detail" } }, true],
  ["transport failure", { throws: true }, true],
  ["configuration failure", { factoryThrows: true }, false],
  ["missing session", { user: null }, false],
  ["unverified identity", { authError: {} }, false],
  ["unapproved user", { member: false }, false],
  ["mismatched administrator ID", { user: { id: "other-id" } }, false],
  ["membership failure", { dbError: {} }, false],
]) {
  test(`admin sign-out safely rejects ${label} without a redirect or session mutation`, async () => {
    const f = signOutFixture(options);
    assert.equal(JSON.stringify(await f.signOutAction({ status: "idle", message: "" }, new FormData())), JSON.stringify(signOutFailure));
    assert.deepEqual(f.calls, contacted ? [[{ scope: "local" }]] : []);
    assert.deepEqual(f.cookieWrites, []);
    assert.deepEqual(f.logs, []);
    assert.equal(f.membershipCalls.includes("participants"), false);
  });
}

test("sign-out form submits the action, prevents duplicate pending submits and announces safe errors", () => {
  const action = () => {};
  for (const pending of [false, true]) {
    const { SignOutForm } = load("../components/admin/sign-out-form.tsx", {
      ...authViewMocks(),
      "@/app/admin/actions": { signOutAction: action },
      react: { useActionState: (handler, initial) => {
        assert.equal(handler, action);
        assert.equal(JSON.stringify(initial), JSON.stringify({ status: "idle", message: "" }));
        return [signOutFailure, action, pending];
      } },
    });
    const view = SignOutForm();
    assert.equal(view.type, "form");
    assert.equal(view.props.action, action);
    assert.equal(view.props["aria-busy"], pending);
    const children = view.props.children.filter(Boolean);
    const button = children.find((node) => node.type === "button");
    assert.equal(button.props.type, "submit");
    assert.equal(button.props.disabled, pending);
    assert.equal(button.props.children, pending ? "Cerrando sesión…" : "Cerrar sesión");
    const feedback = children.find((node) => node.props.role === "alert");
    assert.equal(feedback.props.children, signOutFailure.message);
  }
});

for (const authorized of [false, true]) {
  test(`admin layout renders the sign-out control only after its independent guard (${authorized})`, async () => {
    let checked = 0;
    const { default: AdminLayout, dynamic } = load("../app/admin/layout.tsx", {
      ...authViewMocks(),
      "@/components/ui/button": { buttonVariants: () => "button" },
      "@/components/admin/sign-out-form": { SignOutForm: "sign-out-form" },
      "@/lib/dal/admin": { requireAdmin: async () => {
        checked += 1;
        if (!authorized) throw new Error("private detail");
      } },
      "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    });
    assert.equal(dynamic, "force-dynamic");
    if (authorized) {
      const view = JSON.stringify(await AdminLayout({ children: "protected content" }));
      assert.match(view, /sign-out-form/);
      assert.match(view, /"href":"\/admin"/);
      assert.match(view, /"href":"\/admin\/participants"/);
      assert.match(view, /protected content/);
    } else {
      await assert.rejects(AdminLayout({ children: "protected content" }), { message: "redirect:/login?status=unauthorized" });
    }
    assert.equal(checked, 1);
  });
}

test("public login does not expose the administrative sign-out control", async () => {
  const { client } = adminClient({ user: null });
  const { default: LoginPage } = load("../app/login/page.tsx", {
    ...authViewMocks(),
    "@/lib/supabase/server": { createClient: async () => client },
  });
  const view = JSON.stringify(await LoginPage({ searchParams: Promise.resolve({}) }));
  assert.doesNotMatch(view, /Cerrar sesión|sign-out/i);
  assert.match(view, /login-form/);
});

test("migration structurally fences off privileged data and attendance execution", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/202603130001_attendance_foundation.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/gi);
  assert.match(sql, /for update;/i);
  assert.match(sql, /grant execute on function public\.record_attendance\(text\) to service_role/i);
  assert.match(sql, /revoke all on function public\.record_attendance\(text\) from public, anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.participants from public, anon, authenticated, service_role/i);
  assert.match(sql, /grant insert \(full_name, paid_amount\), update \(full_name, paid_amount\)/i);
  assert.match(sql, /participants_code_key unique \(code\)/i);
  assert.match(sql, /participants_token_key unique \(token\)/i);
  assert.match(sql, /set search_path = ''/i);
});

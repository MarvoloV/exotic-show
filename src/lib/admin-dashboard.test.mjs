import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks = {}, env = { NEXT_PUBLIC_SITE_URL: "https://CANONICAL.test:443/" }) {
  const url = new URL(path, import.meta.url);
  const source = readFileSync(url, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const compiled = { exports: {} };
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports, URL, URLSearchParams, Intl, Date, process: { env },
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

const query = () => load("./participants/query.ts");
test("URL input is normalized and allowlisted, including arrays and invalid boundaries", () => {
  const { parseParticipantQuery } = query();
  const defaults = { q: "", state: "all", sort: "created_at", direction: "desc", page: 1 };
  for (const input of [{}, { q: ["Ana"], state: "other", sort: "token", direction: "asc,token", page: "0" }, { page: "1e3" }, { page: "9007199254740992" }, { page: "1.5" }]) {
    assert.equal(JSON.stringify(parseParticipantQuery(input)), JSON.stringify(defaults));
  }
  const parsed = parseParticipantQuery({ q: "  Ana Pérez  ", state: "attended", sort: "full_name", direction: "asc", page: "3" });
  assert.equal(JSON.stringify(parsed), JSON.stringify({ q: "Ana Pérez", state: "attended", sort: "full_name", direction: "asc", page: 3 }));
  assert.equal(parseParticipantQuery({ q: "a".repeat(201) }).q.length, 200);
});

test("search serializes PostgREST syntax and regex/SQL wildcards as a literal", () => {
  const { literalSearch } = query();
  const input = 'a,b.(x)"\\%_*+?^$[]{}|';
  const expression = literalSearch(input);
  // Decode each quoted PostgREST value, then check its regex matches only the literal.
  const quoted = expression.slice("full_name.imatch.".length).split(",code.imatch.")[0];
  const pattern = JSON.parse(quoted);
  assert.ok(new RegExp(pattern, "i").test(`prefix${input}suffix`));
  assert.equal(new RegExp(pattern, "i").test("a,bXx anything"), false);
  assert.equal(literalSearch("Ana Pérez"), 'full_name.imatch."Ana Pérez",code.imatch."Ana Pérez"');
});

test("pagination URLs retain normalized filters and encode search without expression injection", () => {
  const { parseParticipantQuery, participantHref } = query();
  const normalized = parseParticipantQuery({ q: 'Ana & ",code.eq.x', state: "pending", sort: "code", direction: "asc", page: "2" });
  const url = new URL(participantHref(normalized, 3), "https://example.test");
  assert.equal(url.pathname, "/admin/participants");
  assert.equal(url.searchParams.get("q"), normalized.q);
  assert.equal(url.searchParams.get("page"), "3");
  assert.equal(url.searchParams.get("state"), "pending");
  assert.equal(url.searchParams.get("sort"), "code");
  assert.equal(url.searchParams.get("direction"), "asc");
});

test("decimal formatting preserves exact arbitrarily large totals without a currency", () => {
  const { formatAmount } = load("./participants/format.ts");
  assert.equal(formatAmount("900719925474099312345.09"), "900719925474099312345.09");
  assert.equal(formatAmount("0"), "0.00");
  assert.equal(formatAmount("12.3"), "12.30");
  assert.throws(() => formatAmount("1e10"));
});

test("attendance is displayed in America/Lima across UTC midnight and handles pending", () => {
  const { formatAttendance } = load("./dates.ts");
  assert.equal(formatAttendance(null), "—");
  const rendered = formatAttendance("2026-03-14T02:04:00Z");
  assert.match(rendered, /13\/03\/2026/);
  assert.match(rendered, /21:04/);
});

function fixture({ approved = true, error = null, total = 21, rows = [], env } = {}) {
  const calls = [];
  const builder = {};
  for (const method of ["select", "eq", "or", "order", "range"]) {
    builder[method] = (...args) => { calls.push([method, ...args]); return builder; };
  }
  builder.then = (resolve, reject) => Promise.resolve({ data: rows, count: total, error }).then(resolve, reject);
  const supabase = {
    from: (table) => { calls.push(["from", table]); return builder; },
    rpc: async (name) => { calls.push(["rpc", name]); return { data: [{ registered: "21", attended: "1", pending: "20", paid_total: "9007199254740993.01", attendance_percentage: "4.8" }], error }; },
  };
  const dal = load("./dal/participants.ts", {
    "@/lib/dal/admin": { requireAdmin: async () => {
      calls.push(["authorize"]);
      if (!approved) throw new Error("Acceso administrativo no autorizado.");
      return { supabase };
    } },
  }, env);
  return { ...dal, calls };
}

for (const method of ["getDashboardMetrics", "getParticipants"]) {
  test(`${method} requires approval before accessing data`, async () => {
    const dal = fixture({ approved: false });
    await assert.rejects(dal[method]({}), { message: "Acceso administrativo no autorizado." });
    assert.equal(JSON.stringify(dal.calls), JSON.stringify([["authorize"]]));
  });
  test(`${method} hides database errors`, async () => {
    const dal = fixture({ error: { message: "private details" } });
    await assert.rejects(dal[method]({}), { message: "No se pudieron cargar los datos administrativos." });
  });
}

test("dashboard uses global aggregates and retains decimal strings", async () => {
  const dal = fixture();
  const result = await dal.getDashboardMetrics();
  assert.equal(result.paid_total, "9007199254740993.01");
  assert.equal(result.registered, "21");
  assert.equal(JSON.stringify(dal.calls), JSON.stringify([["authorize"], ["rpc", "admin_dashboard_metrics"]]));
});

test("authorized list selects only needed fields, applies allowlists and stable tie-breaking, and clamps pages", async () => {
  const dal = fixture();
  const result = await dal.getParticipants({ q: "Ana,%_", state: "pending", sort: "full_name", direction: "asc", page: "999" });
  assert.equal(result.query.page, 2);
  assert.equal(result.total, 21);
  const selects = dal.calls.filter(([method]) => method === "select");
  assert.equal(selects.length, 2);
  assert.doesNotMatch(selects[0][1], /token|\*/);
  assert.equal(selects[1][1], "id,code,full_name,paid_amount,attendance_state,attended_at,token");
  assert.ok(dal.calls.some((call) => JSON.stringify(call) === JSON.stringify(["eq", "attendance_state", "PENDIENTE"])));
  assert.ok(dal.calls.some((call) => JSON.stringify(call) === JSON.stringify(["range", 20, 39])));
  assert.equal(JSON.stringify(dal.calls.filter(([method]) => method === "order")), JSON.stringify([
    ["order", "full_name", { ascending: true, nullsFirst: false }], ["order", "id", { ascending: true }],
  ]));
  assert.equal(dal.calls.filter(([method]) => method === "or")[0][1], query().literalSearch("Ana,%_"));
});

test("authorized list constructs canonical attendance links from stored tokens without returning raw tokens", async () => {
  const row = { id: "1", code: "EX001", full_name: "Ana", paid_amount: 10, attendance_state: "PENDIENTE", attended_at: null };
  const tokens = ["a".repeat(64), "b".repeat(64)];
  const dal = fixture({ total: 2, rows: tokens.map((token, i) => ({ ...row, id: String(i + 1), token })) });
  const result = await dal.getParticipants({ origin: "https://evil.test", token: "forged" });
  assert.deepEqual(JSON.parse(JSON.stringify(result.rows)), tokens.map((token, i) => ({
    ...row, id: String(i + 1), attendance_url: `https://canonical.test/asistencia/${token}`,
  })));
  assert.equal(dal.calls[0][0], "authorize");
  assert.equal(dal.calls.some(([method]) => ["insert", "update", "delete", "rpc"].includes(method)), false);
});

test("list fails closed with a generic error for invalid tokens or canonical origins", async () => {
  const message = "No se pudieron cargar los datos administrativos.";
  for (const token of [undefined, "", "A".repeat(64), "a".repeat(63), `${"a".repeat(64)}?x=1`]) {
    await assert.rejects(fixture({ rows: [{ token }] }).getParticipants({}), { message });
  }
  for (const origin of [undefined, "https://user:pass@canonical.test", "https://canonical.test/path", "https://canonical.test?x=1", "https://canonical.test#x", "http://remote.test"]) {
    await assert.rejects(fixture({ rows: [{ token: "a".repeat(64) }], env: { NEXT_PUBLIC_SITE_URL: origin } }).getParticipants({}), { message });
  }
});

test("default list behavior remains unfiltered with newest-first ordering and an empty page", async () => {
  const dal = fixture({ total: 0 });
  const result = await dal.getParticipants({ sort: "token", state: "x", page: "99999999999999" });
  assert.equal(result.query.page, 1);
  assert.equal(result.rows.length, 0);
  assert.equal(dal.calls.some(([method]) => method === "or" || method === "eq" || method === "range"), false);
});

const componentMocks = {
  "next/link": { __esModule: true, default: ({ children, ...props }) => require("react").createElement("a", props, children) },
  "next/form": { __esModule: true, default: ({ children, ...props }) => require("react").createElement("form", props, children) },
  "@/components/admin/refresh-button": { RefreshButton: () => require("react").createElement("button", null, "Actualizar datos") },
};
const render = (element) => require("react-dom/server").renderToStaticMarkup(element);
test("participant component separates empty, no-match and populated accessible states", () => {
  const { ParticipantList } = load("../components/admin/participant-list.tsx", componentMocks);
  const base = { rows: [], total: 0, query: query().parseParticipantQuery({}) };
  assert.match(render(ParticipantList(base)), /Aún no hay participantes/);
  assert.match(render(ParticipantList({ ...base, query: query().parseParticipantQuery({ q: "nobody" }) })), /No se encontraron coincidencias/);
  const html = render(ParticipantList({ ...base, total: 1, rows: [{ id: "1", code: "EX001", full_name: "<Ana>", paid_amount: 10.5, attendance_state: "ASISTIÓ", attended_at: "2026-03-14T02:04:00Z", attendance_url: `https://canonical.test/asistencia/${"a".repeat(64)}` }] }));
  for (const label of ["Código", "Nombres y apellidos", "Estado", "Fecha de ingreso", "Enlace QR", "Copiar enlace", "Pagó", "America/Lima", "10.50", "&lt;Ana&gt;"]) assert.ok(html.includes(label), label);
  assert.match(html, /<caption/);
  assert.match(html, /scope="col"/);
  assert.doesNotMatch(html, /TOKEN|S\/|USD/);
});

test("admin layout requires approval, redirects failures and provides navigation", async () => {
  let authorized = 0;
  const { default: Layout, dynamic } = load("../app/admin/layout.tsx", {
    ...componentMocks,
    "@/lib/dal/admin": { requireAdmin: async () => { authorized++; } },
    "next/navigation": { redirect: () => { throw new Error("redirect"); } },
  });
  assert.equal(dynamic, "force-dynamic");
  const html = render(await Layout({ children: "protected" }));
  assert.equal(authorized, 1);
  assert.match(html, /href="\/admin"/);
  assert.match(html, /href="\/admin\/participants"/);
  const denied = load("../app/admin/layout.tsx", {
    ...componentMocks,
    "@/lib/dal/admin": { requireAdmin: async () => { throw new Error("denied"); } },
    "next/navigation": { redirect: (path) => { throw new Error(path); } },
  });
  await assert.rejects(denied.default({ children: "secret" }), { message: "/login?status=unauthorized" });
});

test("dashboard and participant routes read through their DAL and expose loading/error boundaries", async () => {
  const metrics = { registered: "2", attended: "1", pending: "1", paid_total: "12.30", attendance_percentage: "50.0" };
  const { default: Dashboard } = load("../app/admin/page.tsx", { ...componentMocks, "@/lib/dal/participants": { getDashboardMetrics: async () => metrics } });
  const html = render(await Dashboard());
  for (const text of ["registrados", "asistieron", "pendientes", "pagos", "50.0%", "12.30"]) assert.ok(html.includes(text), text);
  let received;
  const { default: Participants } = load("../app/admin/participants/page.tsx", {
    ...componentMocks,
    "@/lib/dal/participants": { getParticipants: async (params) => { received = params; return { rows: [], total: 0, query: query().parseParticipantQuery(params) }; } },
  });
  assert.match(render(await Participants({ searchParams: Promise.resolve({ q: "Ana" }) })), /No se encontraron coincidencias/);
  assert.equal(received.q, "Ana");
  const { default: Loading } = load("../app/admin/loading.tsx");
  assert.match(render(Loading()), /role="status"/);
  const { default: ErrorBoundary } = load("../app/admin/error.tsx");
  const errorHtml = render(ErrorBoundary({ error: new Error("private"), reset() {} }));
  assert.match(errorHtml, /role="alert"/);
  assert.doesNotMatch(errorHtml, /private/);
});

test("refresh uses router navigation without a full-page reload and announces pending state", () => {
  let refreshed = 0;
  for (const pending of [false, true]) {
    const { RefreshButton } = load("../components/admin/refresh-button.tsx", {
      react: { useTransition: () => [pending, (callback) => callback()] },
      "next/navigation": { useRouter: () => ({ refresh: () => { refreshed++; } }) },
    });
    const element = RefreshButton();
    const [button, status] = element.props.children;
    assert.equal(button.props.disabled, pending);
    assert.equal(status.props.role, "status");
    assert.equal(status.props.children, pending ? "Actualizando…" : "");
    if (!pending) button.props.onClick();
  }
  assert.equal(refreshed, 1);
});

test("aggregate migration is invoker-only, membership-checked and never publicly executable", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/202603130002_admin_dashboard.sql", import.meta.url), "utf8");
  assert.match(sql, /security invoker/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /approved_administrators/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /raise insufficient_privilege/i);
  assert.match(sql, /revoke all on function public\.admin_dashboard_metrics\(\) from public, anon, authenticated, service_role/i);
  assert.match(sql, /grant execute on function public\.admin_dashboard_metrics\(\) to authenticated/i);
  assert.match(sql, /sum\(p\.paid_amount\)/i);
  assert.doesNotMatch(sql, /security definer|p\.token/i);
});

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
    module: compiled, exports: compiled.exports, FormData, URLSearchParams, Intl, Date,
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
const id = "11111111-1111-4111-8111-111111111111";
const initial = { status: "idle", message: "" };
const failure = { status: "error", message: "No se pudo completar la operación. Intenta nuevamente." };
function form(values = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ full_name: "  Ana Pérez  ", paid_amount: "12.30", ...values })) result.set(key, value);
  return result;
}
function fixture({ approved = true, providerError = false, missing = false } = {}) {
  const calls = [];
  let sequence = 1;
  let rows = missing ? [] : [{ id, code: "EX001", full_name: "Original", token: "a".repeat(64), paid_amount: 0, attendance_state: "ASISTIÓ", attended_at: "2026-03-13T12:00:00Z", created_at: "created", updated_at: "updated" }];
  const supabase = { from(table) {
    calls.push(["from", table]);
    let operation, payload, target;
    const builder = {
      insert(value) { operation = "insert"; payload = json(value); calls.push([operation, payload]); return builder; },
      update(value) { operation = "update"; payload = json(value); calls.push([operation, payload]); return builder; },
      delete() { operation = "delete"; calls.push([operation]); return builder; },
      eq(column, value) { target = value; calls.push(["eq", column, value]); return builder; },
      select(columns) { calls.push(["select", columns]); return builder; },
      async single() {
        if (providerError) throw new Error("private database details");
        let row = rows.find((row) => row.id === target);
        if (operation === "insert") {
          sequence++;
          row = { id: "22222222-2222-4222-8222-222222222222", code: `EX00${sequence}`, token: "b".repeat(64), attendance_state: "PENDIENTE", attended_at: null, ...payload };
          rows.push(row);
        } else if (!row) return { data: null, error: { message: "private missing row" } };
        else if (operation === "update") Object.assign(row, payload);
        else if (operation === "delete") rows = rows.filter((item) => item.id !== target);
        return { data: { id: row.id }, error: null };
      },
    };
    return builder;
  } };
  const mocks = {
    "@/lib/dal/admin": { requireAdmin: async () => {
      calls.push(["authorize"]);
      if (!approved) throw new Error("private auth details");
      return { supabase };
    } },
    "next/cache": { revalidatePath: (path) => calls.push(["revalidate", path]) },
  };
  const dal = load("./dal/participants.ts", mocks);
  const actions = load("../app/admin/participants/actions.ts", { ...mocks, "@/lib/dal/participants": dal });
  return { dal, actions, calls, snapshot: () => json({ rows, sequence }) };
}
const mutations = [
  ["createParticipant", "createParticipantAction"],
  ["updateParticipant", "updateParticipantAction"],
  ["deleteParticipant", "deleteParticipantAction"],
];

test("shared validation trims names and accepts decimal boundaries without rounding", () => {
  const { validateParticipant } = load("./participants/validation.ts");
  for (const [name, amount, expected] of [["  Ana Pérez  ", "0", 0], ["a".repeat(200), "9999999999.99", 9999999999.99], ["🙂".repeat(200), "000012.30", 12.3], ["A", "0.01", 0.01]]) {
    assert.deepEqual(json(validateParticipant({ full_name: name, paid_amount: amount })), { ok: true, value: { full_name: name.trim(), paid_amount: expected } });
  }
});

test("shared validation rejects invalid names, payments and non-string form entries", () => {
  const { validateParticipant, participantFormInput, isParticipantId } = load("./participants/validation.ts");
  for (const name of ["", "   ", "a".repeat(201), null, 123, new Blob(["name"])]) assert.equal(validateParticipant({ full_name: name, paid_amount: "0" }).ok, false);
  for (const amount of ["", " ", "-0", "-1", "1.001", "9999999999.991", "10000000000", "1e2", "Infinity", "NaN", "+1", "1,20", null, new Blob(["1"])]) assert.equal(validateParticipant({ full_name: "Ana", paid_amount: amount }).ok, false, String(amount));
  const duplicate = form(); duplicate.append("paid_amount", "9");
  assert.equal(validateParticipant(participantFormInput(duplicate)).ok, false);
  for (const value of ["", null, "all", `${id},id.neq.x`, ` ${id}`, "11111111-1111-4111-8111-11111111111g"]) assert.equal(isParticipantId(value), false);
  assert.equal(isParticipantId(id), true);
});

for (const [dalName, actionName] of mutations) {
  test(`${actionName} and its DAL independently require approved administration`, async () => {
    const f = fixture({ approved: false });
    const before = f.snapshot();
    assert.deepEqual(json(await f.actions[actionName](initial, form({ id }))), failure);
    assert.deepEqual(f.calls, [["authorize"]]);
    f.calls.length = 0;
    await assert.rejects(dalName === "createParticipant" ? f.dal[dalName]({}) : f.dal[dalName](id, {}));
    assert.deepEqual(f.calls, [["authorize"]]);
    assert.deepEqual(f.snapshot(), before);
  });
  test(`${actionName} reports provider failure safely without revalidation`, async () => {
    const f = fixture({ providerError: true });
    const before = f.snapshot();
    assert.deepEqual(json(await f.actions[actionName](initial, form({ id }))), failure);
    assert.equal(f.calls.filter(([method]) => method === "authorize").length, 2);
    assert.equal(f.calls.some(([method]) => method === "revalidate"), false);
    assert.deepEqual(f.snapshot(), before);
  });
}

for (const [dalName, actionName] of mutations.slice(0, 2)) {
  test(`${actionName} validates on server and DAL without writes or consuming codes`, async () => {
    const f = fixture();
    const before = f.snapshot();
    for (const values of [{ full_name: "  " }, { full_name: "a".repeat(201) }, { paid_amount: "1.001" }, { paid_amount: "-1" }, { paid_amount: "10000000000" }]) {
      const result = await f.actions[actionName](initial, form({ id, ...values }));
      assert.equal(result.status, "error");
      assert.equal(result.message, "Revisa los campos indicados.");
      assert.ok(result.errors.full_name || result.errors.paid_amount);
      const input = { full_name: "Ana", paid_amount: "0", ...values };
      await assert.rejects(dalName === "createParticipant" ? f.dal[dalName](input) : f.dal[dalName](id, input), { message: "Revisa los campos indicados." });
    }
    assert.equal(f.calls.some(([method]) => method === "from" || method === "revalidate"), false);
    assert.deepEqual(f.snapshot(), before);
  });
  test(`${actionName} only writes normalized name/payment and revalidates both routes`, async () => {
    const f = fixture();
    const before = f.snapshot();
    const result = await f.actions[actionName]({ status: "success", message: "untrusted" }, form({ id, code: "EX999", token: "malicious", attendance_state: "PENDIENTE", attended_at: "tomorrow", created_at: "forged", updated_at: "forged", extra: "ignored" }));
    assert.deepEqual(json(result), { status: "success", message: dalName === "createParticipant" ? "Participante registrado." : "Participante actualizado." });
    const payload = f.calls.find(([method]) => method === (dalName === "createParticipant" ? "insert" : "update"))[1];
    assert.deepEqual(payload, { full_name: "Ana Pérez", paid_amount: 12.3 });
    assert.deepEqual(f.calls.filter(([method]) => method === "revalidate"), [["revalidate", "/admin"], ["revalidate", "/admin/participants"]]);
    assert.equal(f.calls.filter(([method]) => method === "authorize").length, 2);
    assert.deepEqual(f.calls.filter(([method]) => method === "select"), [["select", "id"]]);
    const after = f.snapshot();
    if (dalName === "updateParticipant") {
      assert.deepEqual(after.rows[0], { ...before.rows[0], full_name: "Ana Pérez", paid_amount: 12.3 });
      assert.equal(after.sequence, before.sequence);
      assert.deepEqual(f.calls.filter(([method]) => method === "eq"), [["eq", "id", id]]);
    } else {
      assert.equal(after.rows[1].code, "EX002");
      assert.equal(after.rows[1].token, "b".repeat(64));
      assert.equal(after.rows[1].attendance_state, "PENDIENTE");
    }
  });
}

for (const [dalName, actionName] of mutations.slice(1)) {
  test(`${actionName} rejects malformed/duplicate IDs and missing rows safely`, async () => {
    const f = fixture();
    const before = f.snapshot();
    for (const bad of ["", "all", `${id},id.neq.x`, ` ${id}`]) {
      assert.deepEqual(json(await f.actions[actionName](initial, form({ id: bad }))), { status: "error", message: "El identificador del participante no es válido." });
      await assert.rejects(f.dal[dalName](bad, { full_name: "Ana", paid_amount: 0 }), { message: "El identificador del participante no es válido." });
    }
    const duplicate = form({ id }); duplicate.append("id", id);
    assert.equal((await f.actions[actionName](initial, duplicate)).status, "error");
    assert.equal(f.calls.some(([method]) => method === "from" || method === "revalidate"), false);
    assert.deepEqual(f.snapshot(), before);
    const missing = fixture({ missing: true });
    assert.deepEqual(json(await missing.actions[actionName](initial, form({ id }))), failure);
    assert.equal(missing.calls.some(([method]) => method === "revalidate"), false);
  });
}

test("delete targets exactly one UUID and successful deletion invalidates its stored QR target", async () => {
  const f = fixture();
  assert.deepEqual(json(await f.actions.deleteParticipantAction(initial, form({ id }))), { status: "success", message: "Participante eliminado. Su QR ya no es válido." });
  assert.deepEqual(f.snapshot(), { rows: [], sequence: 1 });
  assert.deepEqual(f.calls, [["authorize"], ["authorize"], ["from", "participants"], ["delete"], ["eq", "id", id], ["select", "id"], ["revalidate", "/admin"], ["revalidate", "/admin/participants"]]);
});

const render = (element) => require("react-dom/server").renderToStaticMarkup(element);
test("row actions are peer labelled icon buttons without accordions", () => {
  const list = readFileSync(new URL("../components/admin/participant-list.tsx", import.meta.url), "utf8");
  assert.match(list, /className="participant-actions-group"/);
  assert.doesNotMatch(list, /<details className="participant-actions-details"/);
  for (const [file, icon] of [["participant-qr.tsx", "QrCode"], ["participant-edit-dialog.tsx", "Pencil"], ["participant-form.tsx", "Trash2"]]) {
    const source = readFileSync(new URL(`../components/admin/${file}`, import.meta.url), "utf8");
    assert.match(source, new RegExp(`<${icon}[^>]*aria-hidden="true"`));
    assert.match(source, /className="sr-only"/);
    assert.match(source, /title=\{/);
    assert.match(source, /min-h-11 min-w-11/);
  }
});

test("delete opens a native confirmation dialog instead of a disclosure", () => {
  const source = readFileSync(new URL("../components/admin/participant-form.tsx", import.meta.url), "utf8").split("export function DeleteParticipantForm")[1];
  assert.doesNotMatch(source, /<details|<summary/);
  assert.match(source, /<dialog/);
  assert.match(source, /showModal\(\)/);
  assert.match(source, /onCancel=/);
  assert.match(source, /trigger\.current\?\.focus\(\)/);
  for (const text of ["Confirmar eliminación", "Cancelar", "invalidará su QR", "No se puede deshacer"]) assert.ok(source.includes(text));
});
test("delete dialog blocks Escape while pending and restores focus after cancellation", () => {
  const React = require("react");
  const events = [];
  let pending = false;
  const refs = [{ current: { showModal: () => events.push("open"), close: () => events.push("close") } }, { current: { focus: () => events.push("focus") } }];
  let index = 0;
  const Button = () => null;
  const { DeleteParticipantForm } = load("../components/admin/participant-form.tsx", {
    react: { ...React, useId: () => "delete", useRef: () => refs[index++], useActionState: () => [{ status: "error", message: "No se pudo eliminar." }, () => {}, pending] },
    "@/components/ui/button": { Button },
    "@/app/admin/participants/actions": Object.fromEntries(mutations.map(([, name]) => [name, async () => initial])),
  });
  const draw = () => { index = 0; return React.Children.toArray(DeleteParticipantForm({ participant: { id, code: "EX001", full_name: "Ana" } }).props.children); };
  let [trigger, dialog] = draw();
  trigger.props.onClick();
  let prevented = false;
  dialog.props.onCancel({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  dialog.props.onClose();
  assert.deepEqual(events, ["open", "focus"]);
  pending = true;
  [trigger, dialog] = draw();
  dialog.props.onCancel({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  const form = dialog.props.children;
  const controls = React.Children.toArray(form.props.children).find((child) => child.type === "div");
  const [confirm, cancel] = React.Children.toArray(controls.props.children);
  assert.equal(confirm.props.disabled, true);
  assert.equal(cancel.props.disabled, true);
  assert.match(render(dialog), /No se pudo eliminar\./);
  assert.deepEqual(events, ["open", "focus"]);
});

test("forms expose labels, shared client validation, pending/errors and QR deletion confirmation", () => {
  const handlers = [];
  const messages = [initial, { status: "error", message: "Revisa los campos indicados.", errors: { full_name: "Nombre inválido." } }];
  for (const pending of [false, true]) {
    const { ParticipantForm, DeleteParticipantForm } = load("../components/admin/participant-form.tsx", {
      react: { ...require("react"), useActionState: () => [messages[Number(pending)], () => {}, pending] },
      "@/app/admin/participants/actions": Object.fromEntries(mutations.map(([, name]) => [name, async () => initial])),
    });
    const html = render(require("react").createElement(ParticipantForm));
    for (const label of ["Nombres y apellidos", "Monto pagado", "1–200", "9999999999.99"]) assert.ok(html.includes(label), label);
    assert.match(html, /aria-busy=/);
    assert.match(html, /role="(?:status|alert)"/);
    if (pending) { assert.match(html, /Guardando/); assert.match(html, /disabled/); assert.match(html, /aria-invalid="true"/); }
    const confirmation = render(require("react").createElement(DeleteParticipantForm, { participant: { id, full_name: "Ana", code: "EX001" } }));
    assert.match(confirmation, /invalidará su QR/);
    assert.match(confirmation, /No se puede deshacer/);
    assert.match(confirmation, pending ? /Eliminando…/ : /Confirmar eliminación/);
    assert.match(confirmation, /Cancelar/);
    assert.match(confirmation, /aria-describedby=/);
    assert.match(confirmation, /role="group"/);
  }
  const { ParticipantForm } = load("../components/admin/participant-form.tsx", {
    react: { ...require("react"), useActionState: () => [initial, () => {}, false], useState: (value) => [value, (next) => handlers.push(next)], useEffect: () => {}, useId: () => "test" },
    "@/app/admin/participants/actions": Object.fromEntries(mutations.map(([, name]) => [name, async () => initial])),
  });
  const element = ParticipantForm({});
  let prevented = false;
  element.props.onSubmit({ currentTarget: {}, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.ok(handlers.some((value) => value.full_name));
});

test("list retains filtering/pagination links while providing create/edit/delete without navigation", async () => {
  const mocks = {
    "next/link": { __esModule: true, default: ({ children, ...props }) => require("react").createElement("a", props, children) },
    "next/form": { __esModule: true, default: ({ children, ...props }) => require("react").createElement("form", props, children) },
    "@/components/admin/refresh-button": { RefreshButton: () => null },
    "@/app/admin/participants/actions": Object.fromEntries(mutations.map(([, name]) => [name, async () => initial])),
  };
  const query = load("./participants/query.ts").parseParticipantQuery({ q: "Ana", state: "pending", sort: "code", direction: "asc", page: "2" });
  const { ParticipantList } = load("../components/admin/participant-list.tsx", mocks);
  const html = render(require("react").createElement(ParticipantList, { rows: [{ id, code: "EX001", full_name: "Ana", paid_amount: 12.3, attendance_state: "PENDIENTE", attended_at: null }], total: 41, query }));
  for (const text of ["Editar", "Eliminar", "q=Ana", "state=pending", "sort=code", "direction=asc", "page=3"]) assert.ok(html.includes(text), text);
  const { default: Page } = load("../app/admin/participants/page.tsx", { ...mocks, "@/lib/dal/participants": { getParticipants: async () => ({ rows: [], total: 0, query }) } });
  assert.match(render(await Page({ searchParams: Promise.resolve({}) })), /Registrar participante/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const React = require("react");
const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("edit uses a labelled native modal with focus, close and session-safe success", () => {
  const events = [];
  const dialog = { showModal: () => events.push("open"), close: () => events.push("close"), querySelector: () => ({ focus: () => events.push("name focus") }) };
  const trigger = { focus: () => events.push("trigger focus") };
  const refs = [{ current: dialog }, { current: trigger }, { current: 0 }];
  let refIndex = 0;
  let session = 0;
  const ParticipantForm = () => null;
  const ParticipantResetForm = () => null;
  const Button = () => null;
  const mocks = { react: { ...React, useRef: () => refs[refIndex++], useId: () => "edit", useState: () => [session, (value) => { session = value; }], useEffect: (fn) => fn() }, "@/components/admin/participant-form": { ParticipantForm }, "@/components/admin/participant-reset-form": { ParticipantResetForm }, "@/components/ui/button": { Button } };
  const compiled = { exports: {} };
  const output = ts.transpileModule(source("../components/admin/participant-edit-dialog.tsx"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(output, { module: compiled, exports: compiled.exports, require: (name) => mocks[name] ?? require(name) });
  const participant = { id: "id", code: "EX001", full_name: "Ana", attendance_state: "ASISTIÓ", attended_at: "2026-03-13T12:00:00Z" };
  const tree = compiled.exports.ParticipantEditDialog({ participant });
  const [open, modal] = React.Children.toArray(tree.props.children);
  assert.equal(open.props["aria-haspopup"], "dialog");
  assert.equal(modal.type, "dialog"); assert.equal(modal.props["aria-labelledby"], "edit-title");
  const [header] = React.Children.toArray(modal.props.children);
  const [title, close] = React.Children.toArray(header.props.children);
  assert.equal(title.props.id, "edit-title"); assert.equal(close.props.type, "button");
  open.props.onClick();
  assert.equal(session, 1);
  refIndex = 0;
  const reopenedTree = compiled.exports.ParticipantEditDialog({ participant });
  const [, openedModal] = React.Children.toArray(reopenedTree.props.children);
  const [, forms] = React.Children.toArray(openedModal.props.children);
  const [form, reset] = React.Children.toArray(forms.props.children);
  assert.equal(form.type, ParticipantForm); assert.equal(form.props.participant, participant);
  assert.equal(reset.type, ParticipantResetForm); assert.equal(reset.props.participant, participant);
  close.props.onClick(); modal.props.onClose();
  open.props.onClick();
  form.props.onSuccess(); // Old save and reset requests must not close the new session.
  reset.props.onSuccess();
  assert.deepEqual(events, ["open", "name focus", "close", "trigger focus", "open"]);
  refIndex = 0;
  const [, currentModal] = React.Children.toArray(compiled.exports.ParticipantEditDialog({ participant }).props.children);
  const [, currentForms] = React.Children.toArray(currentModal.props.children);
  const [, currentReset] = React.Children.toArray(currentForms.props.children);
  currentReset.props.onSuccess();
  assert.equal(events.at(-1), "close");
});

test("attendance reset is restricted to attended rows and uses the same session-safe callback", () => {
  const dialog = source("../components/admin/participant-edit-dialog.tsx");
  assert.match(dialog, /participant\.attendance_state === "ASISTIÓ"/);
  assert.match(dialog, /participant\.attended_at/);
  assert.match(dialog, /<ParticipantResetForm[^>]*onSuccess=\{closeSession\}/);
  assert.match(dialog, /generation\.current === session/);
  assert.match(dialog, /<ParticipantForm[^>]*onSuccess=\{closeSession\}/);
});

test("list replaces inline edit disclosure with dialog while retaining delete", () => {
  const list = source("../components/admin/participant-list.tsx");
  assert.match(list, /<ParticipantEditDialog participant=\{row\} \/>/);
  assert.doesNotMatch(list, /<summary>Editar/);
  assert.match(list, /<DeleteParticipantForm participant=\{row\} \/>/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const React = require("react");
const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("registration opens a labelled native modal, focuses name, and restores focus on close", () => {
  const events = [];
  const dialog = { showModal: () => events.push("open"), close: () => events.push("close"), querySelector: (selector) => { assert.equal(selector, 'input[name="full_name"]'); return { focus: () => events.push("name focus") }; } };
  const trigger = { focus: () => events.push("trigger focus") };
  const refs = [{ current: dialog }, { current: trigger }];
  const ParticipantForm = () => null;
  const Button = () => null;
  const mocks = { react: { ...React, useRef: () => refs.shift(), useId: () => "unique" }, "@/components/admin/participant-form": { ParticipantForm }, "@/components/ui/button": { Button } };
  const compiled = { exports: {} };
  const output = ts.transpileModule(source("../components/admin/participant-registration-dialog.tsx"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(output, { module: compiled, exports: compiled.exports, require: (name) => mocks[name] ?? require(name) });
  const tree = compiled.exports.ParticipantRegistrationDialog();
  const [open, modal] = React.Children.toArray(tree.props.children);
  assert.equal(open.type, Button); assert.equal(open.props.type, "button"); assert.equal(open.props.children, "+ Registrar participante");
  assert.equal(open.props["aria-haspopup"], "dialog");
  assert.equal(modal.type, "dialog"); assert.equal(modal.props["aria-labelledby"], "unique-title");
  const [header, form] = React.Children.toArray(modal.props.children);
  const [title, close] = React.Children.toArray(header.props.children);
  assert.equal(title.props.id, "unique-title"); assert.equal(title.props.children, "Registrar participante");
  assert.equal(close.type, Button); assert.equal(close.props.type, "button"); assert.equal(close.props.children, "Cerrar registro");
  assert.equal(form.type, ParticipantForm); assert.equal(Object.keys(form.props).length, 0);
  open.props.onClick(); close.props.onClick(); modal.props.onClose();
  assert.deepEqual(events, ["open", "name focus", "close", "trigger focus"]);
});

test("page uses the dialog instead of registration disclosure and styles bound the modal", () => {
  const page = source("../app/admin/participants/page.tsx");
  const css = source("../app/globals.css");
  assert.match(page, /<ParticipantRegistrationDialog\s*\/>/);
  assert.doesNotMatch(page, /<details className="participants-registration"/);
  assert.match(css, /\.participants-screen \.participants-registration-dialog\s*\{[^}]*width:[^}]*42rem/);
  assert.match(css, /\.participants-screen \.participants-registration-dialog\s*\{[^}]*max-height:[^}]*dvh[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.participants-registration-dialog::backdrop/);
});

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import test from "node:test";

async function reservePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function responseIs(response, status, body) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(await response.json(), body);
}

test("production accepts exact Origin or missing Origin with same-context metadata, never foreign origins", { timeout: 30_000 }, async (t) => {
  const port = await reservePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: new URL("../../", import.meta.url),
    env: { PATH: process.env.PATH, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
  });
  // A malformed token proves origin validation passed without a database or credentials.
  const endpoint = `${origin}/asistencia/not-a-valid-token/registro`;
  const deadline = Date.now() + 20_000;
  while (true) {
    assert.equal(child.exitCode, null, `Production server exited: ${output}`);
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(1000) });
      assert.equal(response.status, 405);
      assert.equal(await response.text(), "");
      break;
    } catch (error) {
      if (Date.now() >= deadline) throw new Error(`Production server did not become ready: ${output}`, { cause: error });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const page = await fetch(`${origin}/asistencia/not-a-valid-token`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("referrer-policy"), "strict-origin");
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.match(await page.text(), /<meta name="referrer" content="strict-origin"\s*\/?\s*>/);

  for (const headers of [
    { origin },
    ...["same-origin", "same-site"].flatMap((site) => [
      { origin, "sec-fetch-site": site },
      { "sec-fetch-site": site },
    ]),
  ]) {
    await responseIs(await fetch(endpoint, { method: "POST", headers }), 404, { outcome: "invalid", full_name: null, attended_at: null });
  }
  for (const headers of [
    {},
    { origin: "null" },
    ...["same-origin", "same-site"].flatMap((site) => ["", "null", "not-an-origin", "http://foreign.test", `http://localhost:${port}`, `https://127.0.0.1:${port}`, `${origin}/`].map((value) => ({
      origin: value, "sec-fetch-site": site,
    }))),
    ...[undefined, origin].flatMap((value) => ["cross-site", "none", "", "unexpected"].map((site) => ({
      ...(value === undefined ? {} : { origin: value }), "sec-fetch-site": site,
    }))),
    { "x-forwarded-host": "127.0.0.1", "x-forwarded-proto": "http" },
    { origin: "http://foreign.test", "x-forwarded-host": "foreign.test", "sec-fetch-site": "same-origin" },
  ]) {
    await responseIs(await fetch(endpoint, { method: "POST", headers }), 403, { outcome: "error" });
  }
});

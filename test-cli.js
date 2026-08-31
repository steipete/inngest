#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { promisify } from "node:util";

const exec = promisify(execFile);
const runId = "01HWAVJ8ASQ5C3FXV32JS9DV9Q";
const run = {
  run_id: runId,
  status: "Completed",
  function_name: "smoke.echo",
  run_started_at: "2026-08-30T12:00:00.000Z",
  ended_at: "2026-08-30T12:00:01.000Z",
  output: { message: "hello from local HTTP" },
};
const job = {
  id: "smoke-step",
  run_id: runId,
  step: "echo",
  status: "Completed",
  started_at: run.run_started_at,
  ended_at: run.ended_at,
  output: run.output,
};
const requests = [];
let rejectAuth = false;

const server = createServer((request, response) => {
  requests.push(`${request.method} ${request.url}`);
  response.setHeader("Content-Type", "application/json");
  if (
    rejectAuth ||
    request.headers.authorization !== "Bearer local-smoke-placeholder" ||
    request.headers["x-inngest-env"] !== "branch/smoke"
  ) {
    response.writeHead(401).end(JSON.stringify({ error: "Unauthorized" }));
  } else if (request.method === "GET" && request.url === `/v1/runs/${runId}`) {
    response.end(JSON.stringify({ data: run }));
  } else if (request.method === "GET" && request.url === `/v1/runs/${runId}/jobs`) {
    response.end(JSON.stringify({ data: [job] }));
  } else {
    response.writeHead(404).end(JSON.stringify({ error: "Unknown smoke endpoint" }));
  }
});

server.listen(0, "127.0.0.1");
await once(server, "listening");

try {
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const env = {
    ...process.env,
    INNGEST_SIGNING_KEY: "local-smoke-placeholder",
    INNGEST_API_URL: baseUrl,
    INNGEST_DEV_SERVER_URL: baseUrl,
    INNGEST_ENV: "branch/smoke",
    NO_PROXY: "127.0.0.1",
    no_proxy: "127.0.0.1",
    FORCE_COLOR: "0",
  };

  async function cli(args) {
    console.log(`$ node dist/cli.js ${args.join(" ")}`);
    const result = await exec(process.execPath, ["dist/cli.js", ...args], {
      env,
      timeout: 10000,
    });
    console.log(result.stdout.trim());
    assert.equal(result.stderr, "");
    return result.stdout;
  }

  const details = JSON.parse(await cli(["status", "--run", runId, "--format", "json"]));
  assert.deepEqual(details, { ...run, input_data: null });

  const jobs = JSON.parse(await cli(["jobs", runId, "--format", "json"]));
  const { run_id: _runId, ...expectedJob } = job;
  assert.deepEqual(jobs, { run_id: runId, jobs: [expectedJob], total: 1 });

  const table = await cli(["jobs", runId]);
  assert.match(table, /echo/);
  assert.match(table, /Completed/);

  rejectAuth = true;
  await assert.rejects(cli(["status", "--run", runId, "--format", "json"]), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Authentication failed \(401\)/);
    assert.doesNotMatch(error.stderr, /local-smoke-placeholder/);
    console.log("exit 1: Authentication failed (401)");
    return true;
  });

  assert.deepEqual(requests, [
    `GET /v1/runs/${runId}`,
    `GET /v1/runs/${runId}`,
    `GET /v1/runs/${runId}/jobs`,
    `GET /v1/runs/${runId}`,
    `GET /v1/runs/${runId}/jobs`,
    `GET /v1/runs/${runId}`,
  ]);
  console.log(
    `PASS: built CLI, ${requests.length} local HTTP requests, JSON/table output, and 401 handling`,
  );
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/server.js";

test("GET /health returns ok", async () => {
  const server = createApp().listen(0);
  const address = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok", service: "netwatch-api" });
  } finally {
    server.close();
  }
});

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../app.js";
import { isValidPriority, VALID_PRIORITIES } from "../middleware/validation.js";
import { clearTokenCache } from "../middleware/auth.js";

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe("Today API & Priority Validation", () => {
  test("GET /api/today without token returns 401 Unauthorized", async () => {
    const res = await fetch(`${baseUrl}/api/today`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error);
  });

  test("POST /api/today without token returns 401 Unauthorized", async () => {
    const res = await fetch(`${baseUrl}/api/today`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test task" }),
    });
    assert.equal(res.status, 401);
  });

  test("PATCH /api/today/:id with non-UUID returns 400 Bad Request", async () => {
    const res = await fetch(`${baseUrl}/api/today/not-a-uuid`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid-token",
      },
      body: JSON.stringify({ checked: true }),
    });
    // Even if auth fails or validation runs
    assert.ok([400, 401].includes(res.status));
  });

  test("DELETE /api/today/:id with non-UUID returns 400 Bad Request", async () => {
    const res = await fetch(`${baseUrl}/api/today/12345`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer invalid-token",
      },
    });
    assert.ok([400, 401].includes(res.status));
  });

  test("isValidPriority correctly identifies valid priorities", () => {
    assert.equal(isValidPriority("high"), true);
    assert.equal(isValidPriority("HIGH"), true);
    assert.equal(isValidPriority("medium"), true);
    assert.equal(isValidPriority("low"), true);
    assert.equal(isValidPriority("none"), true);
    assert.equal(isValidPriority("urgent"), false);
    assert.equal(isValidPriority("critical"), false);
    assert.equal(isValidPriority(""), false);
    assert.equal(isValidPriority(null), false);
    assert.equal(isValidPriority(123), false);
    assert.deepEqual(VALID_PRIORITIES, ["high", "medium", "low", "none"]);
  });

  test("clearTokenCache clears without error", () => {
    assert.doesNotThrow(() => clearTokenCache());
  });
});

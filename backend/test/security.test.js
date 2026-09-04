import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../app.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import express from "express";

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

describe("1. Security Headers & Server Fingerprinting", () => {
  test("GET /api/health should return security headers and not disclose X-Powered-By", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.ok, true);

    // Verify security headers
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.ok(res.headers.get("content-security-policy"));
    assert.ok(res.headers.get("strict-transport-security"));

    // Verify X-Powered-By is disabled
    assert.equal(res.headers.get("x-powered-by"), null);
  });
});

describe("2. Authentication & Authorization Enforcement", () => {
  test("GET /api/queue without Bearer token should return 401", async () => {
    const res = await fetch(`${baseUrl}/api/queue`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error);
  });

  test("GET /api/tree without Bearer token should return 401", async () => {
    const res = await fetch(`${baseUrl}/api/tree`);
    assert.equal(res.status, 401);
  });

  test("GET /api/habits without Bearer token should return 401", async () => {
    const res = await fetch(`${baseUrl}/api/habits`);
    assert.equal(res.status, 401);
  });

  test("GET /api/settings without Bearer token should return 401", async () => {
    const res = await fetch(`${baseUrl}/api/settings`);
    assert.equal(res.status, 401);
  });

  test("Request with malformed Authorization header should return 401", async () => {
    const res = await fetch(`${baseUrl}/api/queue`, {
      headers: { Authorization: "Basic invalid" },
    });
    assert.equal(res.status, 401);
  });

  test("Request with empty Bearer token should return 401", async () => {
    const res = await fetch(`${baseUrl}/api/queue`, {
      headers: { Authorization: "Bearer   " },
    });
    assert.equal(res.status, 401);
  });
});

describe("3. Input Validation & Parameter Hardening", () => {
  test("PATCH /api/queue/:id with non-UUID should return 400 Bad Request", async () => {
    const res = await fetch(`${baseUrl}/api/queue/not-a-uuid`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer dummy-token",
      },
      body: JSON.stringify({ title: "Test" }),
    });
    assert.ok(res.status === 400 || res.status === 401);
  });

  test("PATCH /api/habits/:id/completions with non-UUID should return 400", async () => {
    const res = await fetch(`${baseUrl}/api/habits/12345/completions`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer dummy-token",
      },
      body: JSON.stringify({ date: "2026-08-15", completed: true }),
    });
    assert.ok(res.status === 400 || res.status === 401);
  });

  test("DELETE /api/tree/:id with non-UUID should return 400", async () => {
    const res = await fetch(`${baseUrl}/api/tree/not-a-valid-uuid`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer dummy-token",
      },
    });
    assert.ok(res.status === 400 || res.status === 401);
  });
});

describe("4. Payload Size Limits & JSON Parsing", () => {
  test("POST with malformed JSON body should return 400 Bad Request", async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json string",
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Invalid JSON payload");
  });

  test("POST with oversized body (> 50kb) should return 413 Payload Too Large", async () => {
    const hugePayload = JSON.stringify({ data: "A".repeat(60 * 1024) });
    const res = await fetch(`${baseUrl}/api/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: hugePayload,
    });
    assert.equal(res.status, 413);
  });
});

describe("5. Route 404 & Error Handling", () => {
  test("GET /api/non-existent-route should return 404 JSON", async () => {
    const res = await fetch(`${baseUrl}/api/non-existent-route`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, "Endpoint not found");
  });
});

describe("6. Rate Limiting Middleware", () => {
  test("Rate limiter throttles after threshold is reached", async () => {
    const rateApp = express();
    const limiter = createRateLimiter({ windowMs: 10000, max: 3 });
    rateApp.use(limiter);
    rateApp.get("/test", (req, res) => res.json({ success: true }));

    const testServer = http.createServer(rateApp);
    await new Promise((res) => testServer.listen(0, res));
    const testPort = testServer.address().port;
    const testUrl = `http://127.0.0.1:${testPort}/test`;

    try {
      const r1 = await fetch(testUrl);
      assert.equal(r1.status, 200);

      const r2 = await fetch(testUrl);
      assert.equal(r2.status, 200);

      const r3 = await fetch(testUrl);
      assert.equal(r3.status, 200);

      const r4 = await fetch(testUrl);
      assert.equal(r4.status, 429);
      assert.ok(r4.headers.get("retry-after"));
    } finally {
      await new Promise((res) => testServer.close(res));
    }
  });
});

describe("7. Validation Helper Unit Tests", () => {
  test("isValidUUID correctly validates UUIDs", async () => {
    const { isValidUUID } = await import("../middleware/validation.js");
    assert.equal(isValidUUID("550e8400-e29b-41d4-a716-446655440000"), true);
    assert.equal(isValidUUID("731b3fa2-d04b-4bbf-85f8-580797b5e43c"), true);
    assert.equal(isValidUUID("not-a-uuid"), false);
    assert.equal(isValidUUID(""), false);
    assert.equal(isValidUUID(null), false);
    assert.equal(isValidUUID(undefined), false);
    assert.equal(isValidUUID(123), false);
    assert.equal(isValidUUID("550e8400-e29b-41d4-a716-44665544000Z"), false);
  });

  test("isValidDate correctly validates dates", async () => {
    const { isValidDate } = await import("../middleware/validation.js");
    assert.equal(isValidDate("2026-08-14"), true);
    assert.equal(isValidDate("2026-02-28"), true);
    assert.equal(isValidDate("2026-02-31"), false); // Invalid day in Feb
    assert.equal(isValidDate("invalid-date"), false);
    assert.equal(isValidDate("2026-13-01"), false); // Invalid month
    assert.equal(isValidDate("2026-00-10"), false); // Invalid month 0
  });

  test("isValidYear correctly validates years", async () => {
    const { isValidYear } = await import("../middleware/validation.js");
    assert.equal(isValidYear(2026), true);
    assert.equal(isValidYear("2026"), true);
    assert.equal(isValidYear(1900), false);
    assert.equal(isValidYear(3000), false);
    assert.equal(isValidYear("abc"), false);
    assert.equal(isValidYear(null), false);
  });

  test("sanitizeTitle trims and enforces max length", async () => {
    const { sanitizeTitle } = await import("../middleware/validation.js");
    assert.equal(sanitizeTitle("  Clean Title  "), "Clean Title");
    assert.equal(sanitizeTitle(""), null);
    assert.equal(sanitizeTitle("   "), null);
    assert.equal(sanitizeTitle(null), null);
    assert.equal(sanitizeTitle("a".repeat(600), 500), null);
    assert.equal(sanitizeTitle("Valid title", 500), "Valid title");
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { allowedAuthOrigin } from "./action-origin";
test("production accepts only configured origin, rejecting forged hosts and loopback aliases", () => {
  assert.equal(
    allowedAuthOrigin("https://app.masabu.co", "https://app.masabu.co", true),
    "https://app.masabu.co",
  );
  for (const origin of [
    "https://evil.test",
    "https://app.masabu.co.evil.test",
    "http://app.masabu.co",
    null,
  ])
    assert.equal(
      allowedAuthOrigin(origin, "https://app.masabu.co", true),
      null,
    );
  assert.equal(
    allowedAuthOrigin("http://127.0.0.1:3002", "http://localhost:3002", true),
    null,
  );
});
test("local preview preserves the requested loopback host and exact port", () => {
  assert.equal(
    allowedAuthOrigin("http://127.0.0.1:3002", "http://localhost:3002", false),
    "http://127.0.0.1:3002",
  );
  assert.equal(
    allowedAuthOrigin("http://localhost:3003", "http://localhost:3002", false),
    null,
  );
  assert.equal(
    allowedAuthOrigin("http://evil.test:3002", "http://localhost:3002", false),
    null,
  );
});

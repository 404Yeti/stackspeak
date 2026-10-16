import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isNonce, parseBridgeMessage, parseParentMessage } from "./protocol";

// The SAME fixtures are asserted by runner/test/protocol.test.mjs against the bridge-side validators.
const fixtures = JSON.parse(
  readFileSync(join(__dirname, "../../../../runner/test/fixtures/protocol-messages.json"), "utf8"),
) as {
  bridgeToParent: { valid: unknown[]; invalid: unknown[] };
  parentToBridge: { valid: unknown[]; invalid: unknown[] };
  init: { valid: unknown[]; invalid: unknown[] };
};

describe("protocol validators (shared fixtures)", () => {
  it("accepts every valid bridge->parent message", () => {
    for (const message of fixtures.bridgeToParent.valid) {
      expect(parseBridgeMessage(message), JSON.stringify(message)).not.toBeNull();
    }
  });

  it("rejects every invalid bridge->parent message", () => {
    for (const message of fixtures.bridgeToParent.invalid) {
      expect(parseBridgeMessage(message), JSON.stringify(message)).toBeNull();
    }
  });

  it("accepts and rejects the same parent->bridge messages as the runner", () => {
    for (const message of fixtures.parentToBridge.valid) {
      expect(parseParentMessage(message, 50000), JSON.stringify(message)).not.toBeNull();
    }
    for (const message of fixtures.parentToBridge.invalid) {
      expect(parseParentMessage(message, 50000), JSON.stringify(message)).toBeNull();
    }
  });

  it("nonce format matches the runner's init validation", () => {
    for (const init of fixtures.init.valid as { nonce: string }[]) expect(isNonce(init.nonce)).toBe(true);
    expect(isNonce("short")).toBe(false);
    expect(isNonce("0123456789ABCDEF0123456789abcdef")).toBe(false);
    expect(isNonce(undefined)).toBe(false);
  });

  it("never lets a result claim to be 'passed' or 'correct'", () => {
    const base = { t: "result", id: 1, durationMs: 1, startupMs: 1, mode: "build", snapshot: "ready", truncated: false };
    for (const status of ["passed", "failed", "correct", "success"]) {
      expect(parseBridgeMessage({ ...base, status })).toBeNull();
    }
    expect(parseBridgeMessage({ ...base, status: "ok" })).not.toBeNull();
  });

  it("does not pass through unexpected extra fields", () => {
    const parsed = parseBridgeMessage({ t: "out", id: 1, stream: "stdout", text: "x", __proto__x: 1, evil: "<script>" });
    expect(parsed).toEqual({ t: "out", id: 1, stream: "stdout", text: "x" });
  });
});

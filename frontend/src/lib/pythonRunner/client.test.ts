import { describe, expect, it } from "vitest";
import { RUNNER_IFRAME_SANDBOX, createRunnerFrame, isPythonRunnerSupported, parseRunnerUrl } from "./client";
import { getPythonRunnerConfig } from "./config";

describe("runner URL validation", () => {
  it("accepts https origins and loopback http, normalising to the bare origin", () => {
    expect(parseRunnerUrl("https://stackspeak-runner.vercel.app")).toBe("https://stackspeak-runner.vercel.app");
    expect(parseRunnerUrl("https://stackspeak-runner.vercel.app/")).toBe("https://stackspeak-runner.vercel.app");
    expect(parseRunnerUrl("http://127.0.0.1:4010")).toBe("http://127.0.0.1:4010");
    expect(parseRunnerUrl("http://localhost:4010")).toBe("http://localhost:4010");
  });

  it("rejects plain http (non-loopback), paths, queries, hashes, credentials, and garbage", () => {
    for (const bad of [
      "http://stackspeak-runner.vercel.app",
      "https://runner.example/some/path",
      "https://runner.example/?x=1",
      "https://runner.example/#frag",
      "https://user:pw@runner.example/",
      "javascript:alert(1)",
      "data:text/html,hi",
      "not a url",
      "",
    ]) {
      expect(() => parseRunnerUrl(bad), bad).toThrow(TypeError);
    }
  });
});

describe("runner must be a different site from the app (fail closed on misconfiguration)", () => {
  const app = { origin: "https://stackspeak.vercel.app", hostname: "stackspeak.vercel.app" };

  it("refuses the app's own origin or host, with any path-free spelling", () => {
    expect(() => parseRunnerUrl("https://stackspeak.vercel.app", app)).toThrow(/different site/);
    expect(() => parseRunnerUrl("https://stackspeak.vercel.app/", app)).toThrow(/different site/);
    expect(() => parseRunnerUrl("https://stackspeak.vercel.app:8443", app)).toThrow(/different site/);
    expect(() => parseRunnerUrl("https://STACKSPEAK.vercel.app", app)).toThrow(/different site/);
  });

  it("accepts a different host, and loopback on a different port or host", () => {
    expect(parseRunnerUrl("https://stackspeak-runner.vercel.app", app)).toBe("https://stackspeak-runner.vercel.app");
    const dev = { origin: "http://localhost:3000", hostname: "localhost" };
    expect(parseRunnerUrl("http://localhost:4010", dev)).toBe("http://localhost:4010");
    expect(parseRunnerUrl("http://127.0.0.1:4010", dev)).toBe("http://127.0.0.1:4010");
    expect(() => parseRunnerUrl("http://localhost:3000", dev)).toThrow(/different site/);
  });

  it("keeps the runner OFF when the configured URL is the app's own origin", () => {
    const here = globalThis.location.origin;
    expect(getPythonRunnerConfig({ enabled: "true", url: here })).toEqual({ enabled: false });
  });
});

describe("runner iframe", () => {
  it("is created with the least-privileged sandbox and no delegated features", () => {
    const frame = createRunnerFrame(document, "https://runner.example");
    expect(RUNNER_IFRAME_SANDBOX).toBe("allow-scripts allow-same-origin");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");
    expect(frame.getAttribute("allow")).toBe("");
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(frame.getAttribute("aria-hidden")).toBe("true");
    expect(frame.tabIndex).toBe(-1);
    expect(frame.getAttribute("src")).toBe("https://runner.example/");
    for (const dangerous of ["allow-forms", "allow-popups", "allow-modals", "allow-top-navigation", "allow-downloads", "allow-pointer-lock", "allow-presentation", "allow-orientation-lock"]) {
      expect(frame.getAttribute("sandbox")).not.toContain(dangerous);
    }
  });
});

describe("feature detection", () => {
  it("requires WebAssembly, Worker, MessageChannel, and crypto.getRandomValues", () => {
    const full = { WebAssembly: {} as typeof WebAssembly, Worker: function () {} as unknown as typeof Worker, MessageChannel: function () {} as unknown as typeof MessageChannel, crypto: { getRandomValues: () => {} } as unknown as Crypto };
    expect(isPythonRunnerSupported(full)).toBe(true);
    expect(isPythonRunnerSupported({ ...full, WebAssembly: undefined })).toBe(false);
    expect(isPythonRunnerSupported({ ...full, Worker: undefined })).toBe(false);
    expect(isPythonRunnerSupported({ ...full, MessageChannel: undefined })).toBe(false);
    expect(isPythonRunnerSupported({ ...full, crypto: undefined })).toBe(false);
  });
});

describe("feature flag", () => {
  it("is OFF by default and unless explicitly enabled with a valid runner URL", () => {
    expect(getPythonRunnerConfig({})).toEqual({ enabled: false });
    expect(getPythonRunnerConfig({ enabled: "true" })).toEqual({ enabled: false });
    expect(getPythonRunnerConfig({ enabled: "1", url: "https://runner.example" })).toEqual({ enabled: false });
    expect(getPythonRunnerConfig({ enabled: "true", url: "http://runner.example" })).toEqual({ enabled: false });
    expect(getPythonRunnerConfig({ enabled: "true", url: "https://runner.example" })).toEqual({ enabled: true, runnerUrl: "https://runner.example" });
  });
});

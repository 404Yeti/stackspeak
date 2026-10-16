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

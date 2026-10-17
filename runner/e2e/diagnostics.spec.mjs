import { test, expect, deployed } from "./support.mjs";

// The iOS diagnostic page (diag/) is the instrument used to find out WHY a device refuses to run code. These tests prove the
// instrument itself, and pin the safety invariant that matters on every engine: the worker CSP blocks a request to a
// REACHABLE cross-origin host, whether or not the browser also delivers a `securitypolicyviolation` event.
test.describe("CSP diagnostic (instrument + enforcement invariant)", () => {
  test.skip(deployed, "local servers only");

  test("blocks a reachable cross-origin fetch from the production-CSP worker, and reports what the engine does", async ({ browser, prodRunner, attacker }, testInfo) => {
    attacker.seen.length = 0; // the fixture is shared across tests in this worker
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${prodRunner.url}/diag/index.html?target=${encodeURIComponent(attacker.url)}`);
    await page.waitForFunction(() => window.__diagDone === true, null, { timeout: 60_000 });
    const report = await page.evaluate(() => window.__diagReport);
    await context.close();

    // Print per-engine behaviour into the CI log: this is real evidence about how each engine reports violations.
    const summary = report.worker.probes.map((p) => `${p.name}: ${p.outcome} events=${p.eventCount}${p.firstEventMs !== null ? `@${p.firstEventMs}ms` : ""}`);
    console.log(`DIAG[${testInfo.project.name}] doc-event=${report.document.documentEventDelivered}\n  ${summary.join("\n  ")}`);

    expect(report.pageReachedTarget).toBe(true); // control: the target IS reachable, so a block below is the CSP, not the network
    const by = (prefix) => report.worker.probes.find((p) => p.name.startsWith(prefix));
    expect(by("same-origin").outcome).toBe("resolved");
    expect(by("REACHABLE").outcome).toBe("rejected"); // THE invariant: no engine may let the worker reach another origin
    expect(attacker.seen).toEqual(["GET /build-info.json"]); // only the PAGE's reachability control got through; the worker's attempt never reached the server
    expect(report.verdict).not.toMatch(/^UNSAFE/);
    expect(report.worker.probes).toHaveLength(7);
  });
});

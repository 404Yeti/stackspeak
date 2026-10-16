// The bridge iframe must actually load from the (secure) app origin in every engine. This is the first thing
// that has to work before any lifecycle or security test can mean anything, so it is tested on its own.
import { test, expect, openApp } from "./support.mjs";

test("the runner bridge iframe loads inside an https app page", async ({ browser, prodRunner }) => {
  const app = await openApp(browser, prodRunner.parent);
  try {
    const outcome = await app.page.evaluate(async (src) => {
      const messages = [];
      window.addEventListener("securitypolicyviolation", (e) => messages.push(`csp:${e.violatedDirective}:${e.blockedURI}`));
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
      frame.referrerPolicy = "no-referrer";
      const result = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve("timeout"), 8000);
        frame.addEventListener("load", () => { clearTimeout(timer); resolve("load"); });
        frame.addEventListener("error", () => { clearTimeout(timer); resolve("error"); });
        frame.src = src;
        document.body.appendChild(frame);
      });
      return { result, messages, isSecureContext, protocol: location.protocol };
    }, prodRunner.url + "/");
    console.log(`EMBED ${JSON.stringify(outcome)} frames=${JSON.stringify(app.page.frames().map((f) => f.url()))}`);
    expect(outcome.result).toBe("load");
    expect(app.page.frames().some((f) => f.url().startsWith(prodRunner.url))).toBe(true);
  } finally {
    await app.context.close();
  }
});

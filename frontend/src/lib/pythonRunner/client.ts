import { INIT_TYPE, PROTOCOL_VERSION } from "./protocol";
import { PythonRunnerSession, RunnerError } from "./session";

/** Sandbox flags for the runner iframe. Deliberately minimal: no forms, popups, modals, navigation, downloads. */
export const RUNNER_IFRAME_SANDBOX = "allow-scripts allow-same-origin";

export type RunnerClientOptions = {
  /** Origin of the dedicated runner (a DIFFERENT SITE from the app). Path/query/hash are not allowed. */
  runnerUrl: string;
  /** Where to attach the hidden iframe. Defaults to document.body. */
  container?: HTMLElement;
  handshakeTimeoutMs?: number;
  /** Test builds of the runner only; ignored by production builds. */
  hooks?: { forceCold?: boolean; failRestore?: boolean; skipCanary?: boolean };
};

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * https only, except loopback (local development and tests). Returns the bare origin.
 *
 * Refuses a runner on the app's own origin (or, off loopback, the app's own host on another port): the
 * iframe is sandboxed with `allow-same-origin`, which only isolates anything when the runner is a
 * DIFFERENT SITE. A same-origin runner would make `allow-scripts allow-same-origin` equivalent to no
 * sandbox at all, so a mis-set NEXT_PUBLIC_PYTHON_RUNNER_URL must fail closed rather than quietly run.
 */
export function parseRunnerUrl(runnerUrl: string, pageLocation: { origin: string; hostname: string } | undefined = globalThis.location): string {
  let url: URL;
  try {
    url = new URL(runnerUrl);
  } catch {
    throw new TypeError(`Invalid runner URL: ${runnerUrl}`);
  }
  const secure = url.protocol === "https:";
  if (!secure && !(url.protocol === "http:" && LOOPBACK.has(url.hostname))) {
    throw new TypeError("The runner URL must be https (http is only allowed for localhost).");
  }
  if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash || url.username || url.password) {
    throw new TypeError("The runner URL must be a bare origin (no path, query, hash, or credentials).");
  }
  if (pageLocation) {
    const sameOrigin = url.origin === pageLocation.origin;
    const sameHost = url.hostname === pageLocation.hostname && !LOOPBACK.has(url.hostname);
    if (sameOrigin || sameHost) {
      throw new TypeError("The runner must be hosted on a different site from the app (a same-site runner defeats the iframe sandbox).");
    }
  }
  return url.origin;
}

export function isPythonRunnerSupported(env: Partial<Pick<typeof globalThis, "WebAssembly" | "Worker" | "MessageChannel" | "crypto">> = globalThis): boolean {
  return (
    typeof env.WebAssembly === "object" &&
    typeof env.Worker === "function" &&
    typeof env.MessageChannel === "function" &&
    typeof env.crypto?.getRandomValues === "function"
  );
}

function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createRunnerFrame(doc: Document, origin: string): HTMLIFrameElement {
  const frame = doc.createElement("iframe");
  frame.setAttribute("sandbox", RUNNER_IFRAME_SANDBOX);
  frame.setAttribute("allow", ""); // no powerful features (camera, geolocation, …) delegated
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.setAttribute("title", "Python runner (hidden)");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "display:none;width:0;height:0;border:0;";
  frame.src = origin + "/";
  return frame;
}

/**
 * Creates the hidden runner iframe and performs the MessageChannel handshake. The port is posted with
 * the runner's exact origin as targetOrigin, so no other document can receive it; the bridge in turn
 * only accepts it from an approved parent origin. Everything afterwards flows over that private port.
 */
export class PythonRunnerClient {
  private origin: string;
  private frame: HTMLIFrameElement | null = null;
  private session: PythonRunnerSession | null = null;

  constructor(private options: RunnerClientOptions) {
    this.origin = parseRunnerUrl(options.runnerUrl);
  }

  get runnerOrigin(): string {
    return this.origin;
  }

  /** Connects once; further calls return the same session until it is disposed. */
  connect(): PythonRunnerSession {
    if (this.session && this.session.state !== "disposed" && this.session.state !== "failed") return this.session;
    this.teardownFrame();
    if (!isPythonRunnerSupported()) {
      throw new RunnerError("fatal", "This browser cannot run the Python runner.", "unsupported");
    }
    const doc = this.options.container?.ownerDocument ?? document;
    const channel = new MessageChannel();
    const nonce = newNonce();
    const frame = createRunnerFrame(doc, this.origin);
    this.frame = frame;
    const session = new PythonRunnerSession(channel.port1 as unknown as ConstructorParameters<typeof PythonRunnerSession>[0], {
      nonce,
      handshakeTimeoutMs: this.options.handshakeTimeoutMs,
      onClosed: () => this.teardownFrame(),
    });
    this.session = session;
    frame.addEventListener(
      "load",
      () => {
        const target = frame.contentWindow;
        if (!target) return;
        const init: Record<string, unknown> = { type: INIT_TYPE, protocol: PROTOCOL_VERSION, nonce };
        if (this.options.hooks) init.hooks = this.options.hooks;
        target.postMessage(init, this.origin, [channel.port2]);
      },
      { once: true },
    );
    (this.options.container ?? doc.body).appendChild(frame);
    return session;
  }

  dispose(): void {
    this.session?.dispose();
    this.session = null;
    this.teardownFrame();
  }

  private teardownFrame(): void {
    this.frame?.remove(); // removing the iframe also terminates anything running inside it
    this.frame = null;
  }
}

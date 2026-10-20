// Test-only HTTPS terminator. Fixed loopback endpoints; never used in deployment.
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { request } from "node:http";

const server = createServer(
  {
    key: readFileSync(process.env.CLASSROOM_TEST_TLS_KEY),
    cert: readFileSync(process.env.CLASSROOM_TEST_TLS_CERT),
  },
  (incoming, outgoing) => {
    const upstream = request(
      {
        hostname: "127.0.0.1",
        port: 3002,
        path: incoming.url,
        method: incoming.method,
        headers: incoming.headers,
      },
      (response) => {
        outgoing.writeHead(response.statusCode, response.headers);
        response.pipe(outgoing);
        response.on("error", () => outgoing.destroy());
      },
    );
    upstream.on("error", () => {
      if (!outgoing.headersSent) outgoing.writeHead(502);
      outgoing.end("Local test server unavailable");
    });
    incoming.on("error", () => upstream.destroy());
    outgoing.on("close", () => upstream.destroy());
    incoming.pipe(upstream);
  },
);
server.listen(3443, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

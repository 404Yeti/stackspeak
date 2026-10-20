import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";

// Read from stdin; never pass a password in argv or commit these values.
if (process.stdin.isTTY) {
  process.stderr.write(
    "Enter a unique teacher password (input is visible; use a private terminal):\n",
  );
}
const input = createInterface({ input: process.stdin, terminal: false });
let password;
for await (const line of input) {
  password = line;
  input.close();
  break;
}
if (!password || password.length < 16 || password.length > 256) {
  throw new Error("Use a unique password between 16 and 256 characters.");
}
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64, {
  N: 65536,
  r: 8,
  p: 2,
  maxmem: 128 * 1024 * 1024,
});
console.log(`CLASSROOM_PASSWORD_HASH=${salt}:${hash.toString("hex")}`);
console.log(`CLASSROOM_SESSION_SECRET=${randomBytes(48).toString("hex")}`);
console.log("CLASSROOM_ORIGIN=http://localhost:3000");

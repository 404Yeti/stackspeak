import "server-only";
import postgres from "postgres";
import { StudioError } from "./errors";

export type Database = ReturnType<typeof postgres>;
export type Transaction = postgres.TransactionSql;
const connections: Partial<Record<"reader" | "writer", Database>> = {};
export function database(role: "reader" | "writer"): Database {
  if (role === "writer" && process.env.CLASSROOM_CONTENT_SOURCE === "recovery")
    throw new StudioError(503, "Studio is read-only during recovery.");
  if (connections[role]) return connections[role];
  const raw = process.env[`CLASSROOM_DATABASE_${role.toUpperCase()}_URL`];
  try {
    if (!raw) throw new Error();
    const url = new URL(raw);
    const local = !process.env.VERCEL && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      decodeURIComponent(url.username).split(".")[0] !== `classroom_${role}` ||
      (!local && !url.password)) throw new Error();
    // TLS certificate verification stays enabled remotely. Never accept sslmode=no-verify.
    url.search = "";
    const sql = postgres(url.toString(), { max: 2, prepare: false, ssl: local ? false : { rejectUnauthorized: true },
      connect_timeout: 5, idle_timeout: 20, max_lifetime: 60 * 5,
      connection: { statement_timeout: 5000, lock_timeout: 3000, application_name: "stackspeak-classroom" },
      onnotice: () => {} });
    connections[role] = sql;
    return sql;
  } catch {
    throw new StudioError(503, "Exercise storage is unavailable.");
  }
}
export async function closeDatabases() {
  await Promise.all(Object.values(connections).map((db) => db.end({ timeout: 1 })));
  delete connections.reader;
  delete connections.writer;
}

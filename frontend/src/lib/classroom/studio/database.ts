import "server-only";
import postgres from "postgres";
import { X509Certificate } from "node:crypto";
import { StudioError } from "./errors";

export type Database = ReturnType<typeof postgres>;
export type Transaction = postgres.TransactionSql;
const connections: Partial<Record<"reader" | "writer", Promise<Database>>> = {};
export async function database(role: "reader" | "writer"): Promise<Database> {
  if (role === "writer" && process.env.CLASSROOM_CONTENT_SOURCE === "recovery")
    throw new StudioError(503, "Studio is read-only during recovery.");
  if (connections[role]) return connections[role];
  const raw = process.env[`CLASSROOM_DATABASE_${role.toUpperCase()}_URL`];
  try {
    if (!raw) throw new Error();
    const url = new URL(raw);
    const local = !process.env.VERCEL && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    const expectedRole = decodeURIComponent(url.username).split(".")[0];
    const capability = `classroom_${role}`;
    const allowed = process.env.VERCEL_ENV === "production" ? [`${capability}_production`]
      : process.env.VERCEL_ENV === "preview" ? [capability] : [capability, `${capability}_production`];
    if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !allowed.includes(expectedRole) ||
      (!local && !url.password)) throw new Error();
    const ca = process.env.CLASSROOM_DATABASE_CA_CERT;
    if (!local && ca && (ca.length > 64 * 1024 || !new X509Certificate(ca).ca)) throw new Error();
    // The Supabase pooler uses its own CA. Keep chain AND hostname verification enabled.
    url.search = "";
    const sql = postgres(url.toString(), { max: 2, prepare: false, ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
      connect_timeout: 5, idle_timeout: 20, max_lifetime: 60 * 5,
      connection: { statement_timeout: 5000, lock_timeout: 3000, application_name: "stackspeak-classroom" },
      onnotice: () => {} });
    // Verify the authenticated/effective identity before exposing a pool to callers.
    // TLS binds subsequent pool connections to this same server and login identity.
    const ready = (async () => {
      try {
        const [identity] = await sql`select current_user::text as effective_role,
          session_user::text as authenticated_role, rolsuper, rolcreaterole, rolcreatedb,
          rolreplication, rolbypassrls, rolinherit from pg_roles where rolname = current_user`;
        if (!identity || identity.effective_role !== expectedRole || identity.authenticated_role !== expectedRole ||
          [identity.rolsuper, identity.rolcreaterole, identity.rolcreatedb, identity.rolreplication,
            identity.rolbypassrls, identity.rolinherit].some((flag) => flag !== false)) throw new Error();
        return sql;
      } catch {
        delete connections[role];
        await sql.end({ timeout: 1 });
        throw new StudioError(503, "Exercise storage is unavailable.");
      }
    })();
    connections[role] = ready;
    return ready;
  } catch {
    throw new StudioError(503, "Exercise storage is unavailable.");
  }
}
export async function closeDatabases() {
  await Promise.all(Object.values(connections).map(async (pending) => {
    const db = await pending.catch(() => null);
    await db?.end({ timeout: 1 });
  }));
  delete connections.reader;
  delete connections.writer;
}

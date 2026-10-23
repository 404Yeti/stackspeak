// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ allowed: true }));
vi.mock("../auth", () => ({ isTeacher: async () => auth.allowed }));
import { closeDatabases } from "./database";
import { createExercise, getExercise, saveDraft, getGuide, saveGuide, previewExercise, publishExercise,
  unpublishExercise, duplicateExercise, deleteExercise, listExercises, publishedExercise } from "./repository";
import { publishableDraft, syntheticGuide } from "@/test/studioFixtures";
import catalog from "../../../../content/classroom/exercises.json";
import { importCatalog } from "./importer";
import { parseExercises, studentProjection } from "../schema";
import { makeTestGuides } from "@/test/classroomFixtures";
import { withPublicationLedger } from "./recovery";
const enabled = !!process.env.CLASSROOM_TEST_DATABASE_URL;
describe.skipIf(!enabled)("Studio disposable Postgres integration", () => {
  let admin: ReturnType<typeof postgres>;
  beforeAll(() => {
    const url = new URL(process.env.CLASSROOM_TEST_DATABASE_URL!);
    if (url.hostname !== "127.0.0.1" || url.port !== "55479" || url.username !== "studio_test_admin")
      throw new Error("Use the isolated test-studio-db script only");
    admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
  });
  afterAll(async () => { await closeDatabases(); await admin?.end(); });
  it("denies API roles even with BYPASSRLS and when schema is explicitly requested", async () => {
    for (const role of ["anon", "authenticated", "service_role", "authenticator"]) {
      const [row] = await admin`select has_schema_privilege(${role}, 'classroom', 'usage') as usage,
        has_table_privilege(${role}, 'classroom.teacher_guides', 'select') as guide,
        has_table_privilege(${role}, 'classroom.exercises', 'select') as draft,
        has_table_privilege(${role}, 'classroom.published_exercises', 'select') as published`;
      expect(row).toEqual({ usage: false, guide: false, draft: false, published: false });
      await expect(admin.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`); // fixed role allowlist above, no request input
        await tx`select * from classroom.teacher_guides`;
      })).rejects.toMatchObject({ code: "42501" });
    }
    const functionGrants = await admin`select has_function_privilege('anon', 'classroom.safe_student(jsonb)', 'execute') as exposed`;
    expect(functionGrants[0].exposed).toBe(false);
    const tables = await admin`select relrowsecurity, relforcerowsecurity from pg_class c
      join pg_namespace n on c.relnamespace = n.oid where n.nspname = 'classroom' and c.relkind = 'r'`;
    expect(tables).toHaveLength(4);
    expect(tables.every((t) => t.relrowsecurity && t.relforcerowsecurity)).toBe(true);
    const roles = await admin`select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb from pg_roles
      where rolname in ('classroom_reader','classroom_writer')`;
    expect(roles.every((r) => !r.rolsuper && !r.rolbypassrls && !r.rolcreaterole && !r.rolcreatedb)).toBe(true);
  });
  it("Production identities inherit only their capability role without SET or ADMIN", async () => {
    const memberships = await admin`select pg_get_userbyid(roleid) as capability,
      pg_get_userbyid(member) as login, inherit_option, set_option, admin_option
      from pg_auth_members where pg_get_userbyid(member) in ('classroom_reader_production','classroom_writer_production')`;
    expect(memberships).toHaveLength(2);
    for (const row of memberships) {
      expect(row.login).toBe(`${row.capability}_production`);
      expect(row.inherit_option).toBe(true);
      expect(row.set_option).toBe(false);
      expect(row.admin_option).toBe(false);
    }
    const reader = postgres(process.env.CLASSROOM_DATABASE_READER_URL!, { max: 1 });
    try {
      for (const statement of ["set role studio_test_admin", "alter table classroom.published_exercises disable row level security", "create role unexpected_test_role"]) {
        await expect(reader.unsafe(statement)).rejects.toMatchObject({ code: "42501" });
      }
    } finally { await reader.end(); }
  });
  it("persists drafts and vocabulary across connections and isolates guides and public snapshots", async () => {
    const created = await createExercise("Python", "Test lesson");
    expect(created.publication).toBe("draft");
    expect(created.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(await publishedExercise(created.slug)).toBeNull();
    const draft = publishableDraft();
    draft.vocabulary[0].readLines = [1, 3];
    let { lockVersion } = await saveDraft(created.id, created.lockVersion, draft);
    await closeDatabases(); // new real connections, not an in-memory repository
    expect((await getExercise(created.id)).draft).toEqual(draft);
    ({ lockVersion } = await saveGuide(created.id, lockVersion, syntheticGuide()));
    expect((await getGuide(created.id)).guide).toEqual(syntheticGuide());
    expect(JSON.stringify(await getExercise(created.id))).not.toContain("PRIVATE_CANARY");
    expect(JSON.stringify(await previewExercise(created.id))).not.toContain("PRIVATE_CANARY");
    const first = await publishExercise(created.id, lockVersion);
    lockVersion = first.lockVersion;
    const publicBefore = await publishedExercise(created.slug);
    expect(publicBefore?.title).toBe(draft.content.title);
    expect(JSON.stringify(publicBefore)).not.toContain("PRIVATE_CANARY");
    draft.content.title = "Changed draft only";
    draft.vocabulary.reverse();
    ({ lockVersion } = await saveDraft(created.id, lockVersion, draft));
    expect((await getExercise(created.id)).hasUnpublishedChanges).toBe(true);
    expect(await publishedExercise(created.slug)).toEqual(publicBefore);
    await expect(saveDraft(created.id, lockVersion - 1, draft)).rejects.toMatchObject({ status: 409 });
    const republished = await publishExercise(created.id, lockVersion);
    expect(republished.version).toBe(first.version + 1);
    expect((await publishedExercise(created.slug))?.title).toBe("Changed draft only");
    expect((await getExercise(created.id)).hasUnpublishedChanges).toBe(false);
    await expect(deleteExercise(created.id, republished.lockVersion)).rejects.toMatchObject({ status: 409 });
    const copy = await duplicateExercise(created.id, republished.lockVersion);
    expect(copy.slug).not.toBe(created.slug);
    expect(await publishedExercise(copy.slug)).toBeNull();
    expect((await getGuide(copy.id)).guide).toEqual(syntheticGuide());
    ({ lockVersion } = await unpublishExercise(created.id, republished.lockVersion));
    expect(await publishedExercise(created.slug)).toBeNull();
    expect((await getExercise(created.id)).publication).toBe("draft");
    await deleteExercise(created.id, lockVersion);
    await expect(getExercise(created.id)).rejects.toMatchObject({ status: 404 });
  });
  it("recovers legacy null references without losing vocabulary or changing published snapshots", async () => {
    const created = await createExercise("Python", "Reference recovery");
    const draft = publishableDraft();
    draft.vocabulary = draft.vocabulary.slice(0, 2);
    draft.vocabulary.push({ term: "third", definition: "Preserved definition", example: "Preserved example", readLines: [1] });
    const saved = await saveDraft(created.id, created.lockVersion, draft);
    const published = await publishExercise(created.id, saved.lockVersion);
    const before = await publishedExercise(created.slug);
    await admin`update classroom.vocabulary set entry = jsonb_set(entry, '{readLines}', '[null]'::jsonb)
      where exercise_id = ${created.id} and position = 2`;
    const recovered = await getExercise(created.id);
    expect(recovered.recoveredReadLines).toEqual([3]);
    expect(recovered.draft.vocabulary).toEqual([...draft.vocabulary.slice(0, 2), { ...draft.vocabulary[2], readLines: [] }]);
    expect(recovered.lockVersion).toBe(published.lockVersion);
    const unchanged = await admin`select entry->'readLines' as lines from classroom.vocabulary where exercise_id = ${created.id} and position = 2`;
    expect(unchanged[0].lines).toEqual([null]); // opening did not write or discard stored content
    const fixed = await saveDraft(created.id, recovered.lockVersion, recovered.draft);
    expect((await getExercise(created.id)).recoveredReadLines).toEqual([]);
    expect((await getExercise(created.id)).draft.vocabulary[2].readLines).toEqual([]);
    expect(await publishedExercise(created.slug)).toEqual(before);
    const corrected = structuredClone(recovered.draft); corrected.vocabulary[2].readLines = [1, 2];
    await saveDraft(created.id, fixed.lockVersion, corrected);
    await closeDatabases();
    expect((await getExercise(created.id)).draft).toEqual(corrected);
    expect(await publishedExercise(created.slug)).toEqual(before);
  });
  it("validates publication, line references and guide question IDs; filters and bounds the library", async () => {
    const e = await createExercise("C#", "Injection ' OR true -- <script>");
    await expect(publishExercise(e.id, e.lockVersion)).rejects.toThrow();
    const draft = publishableDraft();
    draft.content.language = "C#";
    draft.content.difficulty = "Advanced";
    const { lockVersion } = await saveDraft(e.id, e.lockVersion, draft);
    await expect(saveGuide(e.id, lockVersion, { ...syntheticGuide(), answers: [{ questionId: "missing", spokenExample: "x", listenFor: [] }] }))
      .rejects.toMatchObject({ status: 422 });
    expect((await listExercises({ language: "C#", difficulty: "Advanced", limit: 1 })).exercises).toHaveLength(1);
    expect((await listExercises({ search: "' OR true --" })).exercises).toHaveLength(0);
    draft.vocabulary[0].readLines = [9999];
    await expect(saveDraft(e.id, lockVersion, draft)).rejects.toThrow();
    expect((await getExercise(e.id)).lockVersion).toBe(lockVersion);
    auth.allowed = false;
    try {
      await expect(getGuide(e.id)).rejects.toMatchObject({ status: 401 });
      await expect(saveDraft(e.id, lockVersion, draft)).rejects.toMatchObject({ status: 401 });
      await expect(listExercises({})).rejects.toMatchObject({ status: 401 });
    } finally { auth.allowed = true; }
  });
  it("reader cannot obtain drafts/guides or mutate public data; DB constraints reject inconsistent states", async () => {
    const reader = postgres(process.env.CLASSROOM_DATABASE_READER_URL!, { max: 1 });
    try {
      await expect(reader`select * from classroom.exercises`).rejects.toMatchObject({ code: "42501" });
      await expect(reader`select * from classroom.teacher_guides`).rejects.toMatchObject({ code: "42501" });
      await expect(reader`delete from classroom.published_exercises`).rejects.toMatchObject({ code: "42501" });
    } finally { await reader.end(); }
    const e = await createExercise("Python");
    await expect(admin`update classroom.exercises set publication = 'published', published_at = now(),
      first_published_at = now(), published_checksum = 'x' where id = ${e.id}`).rejects.toMatchObject({ code: "P0001" });
    const draft = publishableDraft();
    const saved = await saveDraft(e.id, e.lockVersion, draft);
    await publishExercise(e.id, saved.lockVersion);
    await expect(admin`update classroom.exercises set slug = 'changed-slug' where id = ${e.id}`).rejects.toThrow();
    await expect(admin`update classroom.published_exercises set student_payload = student_payload || '{"privateNotes":"CANARY"}'::jsonb
      where exercise_id = ${e.id}`).rejects.toMatchObject({ code: "23514" });
  });
  it("imports all legacy content idempotently without overwriting edits or reviving unpublished seeds", async () => {
    const guides = makeTestGuides(parseExercises(catalog), "IMPORT_PRIVATE_CANARY");
    const dry = await importCatalog(catalog, undefined);
    expect(dry.mode).toBe("dry-run");
    expect(dry.exercises.every((e) => e.action === "insert")).toBe(true);
    const before = await admin`select count(*)::integer as n from classroom.exercises where import_source is not null`;
    expect(before[0].n).toBe(0);
    const imported = await importCatalog(catalog, guides, true);
    expect(imported.missingGuides).toBe(0);
    const repeated = await importCatalog(catalog, guides, true);
    expect(repeated.exercises.every((e) => e.action === "skip" && e.guide === "skip")).toBe(true);
    for (const e of parseExercises(catalog)) {
      const shared = await publishedExercise(e.slug);
      if (e.publication === "draft") { expect(shared).toBeNull(); continue; }
      const legacy = { ...shared! };
      Reflect.deleteProperty(legacy, "readContent"); Reflect.deleteProperty(legacy, "learningObjectives");
      expect(legacy).toEqual(studentProjection(e));
      expect(JSON.stringify(shared)).not.toContain("IMPORT_PRIVATE_CANARY");
    }
    const rows = await admin`select id from classroom.exercises where slug = 'python-loop-accumulator'`;
    const current = await getExercise(rows[0].id);
    current.draft.content.title = "Teacher's later edit";
    const saved = await saveDraft(current.id, current.lockVersion, current.draft);
    await importCatalog(catalog, guides, true);
    expect((await getExercise(current.id)).draft.content.title).toBe("Teacher's later edit");
    await expect(importCatalog([{ ...catalog[0], title: "Conflicting replacement" }, ...catalog.slice(1)], guides, true)).rejects.toThrow("conflict");
    await unpublishExercise(current.id, saved.lockVersion);
    await importCatalog(catalog, guides, true);
    expect(await publishedExercise(current.slug)).toBeNull();
  });
  it("recovers published snapshots on DB read failure and never resurrects a deny after partial failure", async () => {
    const e = await createExercise("Python");
    const saved = await saveDraft(e.id, e.lockVersion, publishableDraft());
    await publishExercise(e.id, saved.lockVersion);
    const original = process.env.CLASSROOM_DATABASE_READER_URL!;
    await closeDatabases();
    process.env.CLASSROOM_DATABASE_READER_URL = "postgres://classroom_reader@127.0.0.1:1/postgres";
    try { expect((await publishedExercise(e.slug))?.title).toBe(publishableDraft().content.title); }
    finally { await closeDatabases(); process.env.CLASSROOM_DATABASE_READER_URL = original; }
    await expect(withPublicationLedger(async (ledger) => { await ledger.deny(e.slug); throw new Error("Crash before DB unpublish"); })).rejects.toThrow();
    const db = await admin`select publication from classroom.exercises where id = ${e.id}`;
    expect(db[0].publication).toBe("published");
    expect(await publishedExercise(e.slug)).toBeNull();
  });

  it("publishes atomically in studio mode, keeps private edits isolated, and fails closed on outage after revocation", async () => {
    const source = process.env.CLASSROOM_CONTENT_SOURCE;
    const reader = process.env.CLASSROOM_DATABASE_READER_URL!;
    process.env.CLASSROOM_CONTENT_SOURCE = "studio";
    try {
      const e = await createExercise("Python", "Database authoritative lesson");
      const saved = await saveDraft(e.id, e.lockVersion, publishableDraft());
      const guided = await saveGuide(e.id, saved.lockVersion, syntheticGuide());
      const live = await publishExercise(e.id, guided.lockVersion);
      expect(JSON.stringify(await publishedExercise(e.slug))).not.toContain("PRIVATE_CANARY");
      const draft = publishableDraft(); draft.content.title = "Unpublished edit";
      const edited = await saveDraft(e.id, live.lockVersion, draft);
      expect((await publishedExercise(e.slug))?.title).not.toBe("Unpublished edit");
      await unpublishExercise(e.id, edited.lockVersion);
      expect(await publishedExercise(e.slug)).toBeNull();
      await closeDatabases();
      process.env.CLASSROOM_DATABASE_READER_URL = "postgres://classroom_reader@127.0.0.1:1/postgres";
      await expect(publishedExercise(e.slug)).rejects.toThrow();
      expect((await publishedExercise("python-loop-accumulator"))?.language).toBe("Python");
      expect(await publishedExercise("csharp-await-task")).toBeNull();
      await closeDatabases(); process.env.CLASSROOM_DATABASE_READER_URL = reader;
      expect(await publishedExercise(e.slug)).toBeNull();
    } finally {
      await closeDatabases(); process.env.CLASSROOM_DATABASE_READER_URL = reader; process.env.CLASSROOM_CONTENT_SOURCE = source;
    }
  });

});

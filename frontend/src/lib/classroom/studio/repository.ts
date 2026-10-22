import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { authorizeTeacher } from "./authorization";
import { database, type Transaction } from "./database";
import { withPublicationLedger, recoverySnapshot, publicChecksum, type PublicationLedger } from "./recovery";
import { currentStudentSnapshot, reservedSourceSlug, validateSnapshotTransport } from "./publicationSnapshot";
import { StudioError } from "./errors";
import { contentSchema, draftSchema, guideSchema, idSchema, slugSchema, studentSchema,
  projectStudent, validatePublish, emptyDraft, type Draft, type Guide } from "./validation";

const rowSchema = z.object({ id: idSchema, legacy_id: z.string().nullable(), slug: slugSchema,
  content: contentSchema, publication: z.enum(["draft", "published"]), version: z.number().int(),
  lock_version: z.number().int(), created_at: z.coerce.date(), updated_at: z.coerce.date(),
  published_at: z.coerce.date().nullable(), first_published_at: z.coerce.date().nullable(),
  published_checksum: z.string().nullable() });
type ExerciseRow = z.infer<typeof rowSchema>;
const checksum = (draft: Draft) => createHash("sha256").update(JSON.stringify(draftSchema.parse(draft))).digest("hex");
async function locked(tx: Transaction, id: string, expectedVersion?: number) {
  const rows = await tx`select id, legacy_id, slug, content, publication, version, lock_version,
    created_at, updated_at, published_at, first_published_at, published_checksum
    from classroom.exercises where id = ${idSchema.parse(id)} for update`;
  if (!rows[0]) throw new StudioError(404, "Exercise not found.");
  const row = rowSchema.parse(rows[0]);
  if (expectedVersion !== undefined && row.lock_version !== expectedVersion)
    throw new StudioError(409, "This exercise changed. Reload before saving.");
  return row;
}
async function draftFor(tx: Transaction, row: ExerciseRow): Promise<Draft> {
  const rows = await tx`select entry from classroom.vocabulary where exercise_id = ${row.id} order by position`;
  return draftSchema.parse({ content: row.content, vocabulary: rows.map((r) => r.entry) });
}
function metadata(row: ExerciseRow, draft: Draft) {
  return { id: row.id, slug: row.slug, publication: row.publication, version: row.version,
    lockVersion: row.lock_version, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at?.toISOString() ?? null,
    hasUnpublishedChanges: row.publication === "published" && row.published_checksum !== checksum(draft) };
}
async function replaceVocabulary(tx: Transaction, id: string, draft: Draft) {
  await tx`delete from classroom.vocabulary where exercise_id = ${id}`;
  for (const [position, entry] of draft.vocabulary.entries())
    await tx`insert into classroom.vocabulary (exercise_id, position, entry) values (${id}, ${position}, ${tx.json(entry)})`;
}
async function touch(tx: Transaction, id: string) {
  const rows = await tx`update classroom.exercises set lock_version = lock_version + 1 where id = ${id} returning lock_version`;
  return rows[0].lock_version as number;
}
export const libraryQuerySchema = z.strictObject({
  search: z.string().max(200).default(""), language: z.enum(["Python", "C#"]).optional(),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(), topic: z.string().max(100).optional(),
  status: z.enum(["draft", "published"]).optional(), offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});
export async function listExercises(query: unknown) {
  await authorizeTeacher();
  const q = libraryQuerySchema.parse(query);
  const sql = await database("writer");
  // Offset paging is sufficient for the bounded single-owner library. Values are always parameters.
  const rows = await sql`select id, slug, content->>'title' as title, content->>'language' as language,
    content->>'difficulty' as difficulty, content->>'topic' as topic, publication,
    lock_version as "lockVersion", updated_at as "updatedAt"
    from classroom.exercises
    where (${q.search} = '' or concat_ws(' ', content->>'title', content->>'description', content->>'topic') ilike ${'%' + q.search.replace(/[\\%_]/g, "\\$&") + '%'})
    and (${q.language ?? null}::text is null or content->>'language' = ${q.language ?? null})
    and (${q.difficulty ?? null}::text is null or content->>'difficulty' = ${q.difficulty ?? null})
    and (${q.topic ?? null}::text is null or content->>'topic' = ${q.topic ?? null})
    and (${q.status ?? null}::text is null or publication = ${q.status ?? null})
    order by updated_at desc, id limit ${q.limit} offset ${q.offset}`;
  return { exercises: Array.from(rows), offset: q.offset, limit: q.limit };
}
export async function createExercise(language: "Python" | "C#", title = "") {
  await authorizeTeacher();
  const draft = draftSchema.parse(emptyDraft(language, title));
  const sql = await database("writer");
  // IDs and collision-free stable slugs are generated in Postgres, never accepted from a client.
  const rows = await sql`insert into classroom.exercises (content) values (${sql.json(draft.content)}) returning id, slug`;
  return getExercise(rows[0].id);
}
export async function getExercise(id: string) {
  await authorizeTeacher();
  return (await database("writer")).begin(async (tx) => {
    const row = await locked(tx, id);
    const draft = await draftFor(tx, row);
    return { ...metadata(row, draft), draft };
  });
}
export async function saveDraft(id: string, expectedVersion: number, input: Draft) {
  await authorizeTeacher();
  const draft = draftSchema.parse(input);
  return (await database("writer")).begin(async (tx) => {
    const row = await locked(tx, id, expectedVersion);
    await tx`update classroom.exercises set content = ${tx.json(draft.content)} where id = ${row.id}`;
    await replaceVocabulary(tx, row.id, draft);
    return { lockVersion: await touch(tx, row.id) };
  });
}
export async function getGuide(id: string) {
  await authorizeTeacher();
  return (await database("writer")).begin(async (tx) => {
    const row = await locked(tx, id);
    const guides = await tx`select content from classroom.teacher_guides where exercise_id = ${row.id}`;
    return { lockVersion: row.lock_version, guide: guides[0] ? guideSchema.parse(guides[0].content) : null };
  });
}
export async function saveGuide(id: string, expectedVersion: number, input: Guide) {
  await authorizeTeacher();
  const guide = guideSchema.parse(input);
  return (await database("writer")).begin(async (tx) => {
    const row = await locked(tx, id, expectedVersion);
    if (guide.answers.some((a) => !row.content.questions.some((q) => q.id === a.questionId)))
      throw new StudioError(422, "Guide answers must reference current questions.");
    await tx`insert into classroom.teacher_guides (exercise_id, content) values (${row.id}, ${tx.json(guide)})
      on conflict (exercise_id) do update set content = excluded.content, updated_at = now()`;
    return { lockVersion: await touch(tx, row.id) };
  });
}
export async function previewExercise(id: string) {
  await authorizeTeacher();
  return (await database("writer")).begin(async (tx) => {
    const row = await locked(tx, id);
    return projectStudent(row.legacy_id ?? row.id, row.slug, Math.max(1, row.version), await draftFor(tx, row));
  });
}
export async function publishExercise(id: string, expectedVersion: number) {
  await authorizeTeacher();
  const commit = async (ledger?: PublicationLedger) => {
    let published;
    const result = await (await database("writer")).begin(async (tx) => {
      const row = await locked(tx, id, expectedVersion);
      if (!ledger && reservedSourceSlug(row.slug)) throw new StudioError(409, "Existing source lessons remain in the teaching library until migration.");
      const draft = await draftFor(tx, row);
      validatePublish(draft);
      const guides = await tx`select content from classroom.teacher_guides where exercise_id = ${row.id}`;
      if (guides[0] && guideSchema.parse(guides[0].content).answers.some((a) => !draft.content.questions.some((q) => q.id === a.questionId)))
        throw new StudioError(422, "Update the teacher guide for removed questions before publishing.");
      const version = row.version + 1;
      const payload = projectStudent(row.legacy_id ?? row.id, row.slug, version, draft);
      if (!ledger) validateSnapshotTransport(payload);
      await ledger?.deny(row.slug); // independent journal only in recovery-backed mode
      await tx`insert into classroom.published_exercises (exercise_id, slug, student_payload, version)
        values (${row.id}, ${row.slug}, ${tx.json(payload)}, ${version})
        on conflict (exercise_id) do update set student_payload = excluded.student_payload,
        version = excluded.version, published_at = now()`;
      await tx`update classroom.exercises set publication = 'published', version = ${version},
        published_checksum = ${checksum(draft)}, published_at = now(), first_published_at = coalesce(first_published_at, now())
        where id = ${row.id}`;
      published = payload;
      return { lockVersion: await touch(tx, row.id), studentPath: `/exercises/${row.slug}`, version };
    });
    if (!published) throw new Error("Publication failed");
    await ledger?.activate(published); // database-only mode publishes atomically in SQL, with no fallback
    return result;
  };
  return process.env.CLASSROOM_CONTENT_SOURCE === "studio" ? commit() : withPublicationLedger(commit);
}
export async function unpublishExercise(id: string, expectedVersion: number) {
  await authorizeTeacher();
  const commit = async (ledger?: PublicationLedger) => (await database("writer")).begin(async (tx) => {
    const row = await locked(tx, id, expectedVersion);
    if (!ledger && reservedSourceSlug(row.slug)) throw new StudioError(409, "Existing source lessons remain in the teaching library until migration.");
    await ledger?.deny(row.slug); // database-only mode removes visibility with the SQL commit
    await tx`delete from classroom.published_exercises where exercise_id = ${row.id}`;
    await tx`update classroom.exercises set publication = 'draft', published_checksum = null where id = ${row.id}`;
    return { lockVersion: await touch(tx, row.id) };
  });
  return process.env.CLASSROOM_CONTENT_SOURCE === "studio" ? commit() : withPublicationLedger(commit);
}
export async function deleteExercise(id: string, expectedVersion: number) {
  await authorizeTeacher();
  return (await database("writer")).begin(async (tx) => {
    const row = await locked(tx, id, expectedVersion);
    if (row.publication === "published") throw new StudioError(409, "Unpublish before deleting.");
    await tx`delete from classroom.exercises where id = ${row.id}`;
    return { deleted: true };
  });
}
export async function duplicateExercise(id: string, expectedVersion: number) {
  await authorizeTeacher();
  return (await database("writer")).begin(async (tx) => {
    const row = await locked(tx, id, expectedVersion);
    const draft = await draftFor(tx, row);
    draft.content.title = `${draft.content.title.slice(0, 193)} (copy)`;
    const rows = await tx`insert into classroom.exercises (content) values (${tx.json(draft.content)}) returning id, slug`;
    const copy = rows[0];
    await replaceVocabulary(tx, copy.id, draft);
    await tx`insert into classroom.teacher_guides (exercise_id, content)
      select ${copy.id}, content from classroom.teacher_guides where exercise_id = ${row.id}`;
    return { id: copy.id as string, slug: copy.slug as string, lockVersion: 1, publication: "draft" as const };
  });
}
// The independent journal governs public visibility, including during database failures.
export async function publishedExercise(slug: string) {
  slugSchema.parse(slug);
  if (process.env.CLASSROOM_CONTENT_SOURCE === "studio") return currentStudentSnapshot(slug);
  const recovery = await recoverySnapshot(slugSchema.parse(slug));
  if (!recovery) return null;
  if (process.env.CLASSROOM_CONTENT_SOURCE === "recovery") return recovery.exercise;
  let rows;
  try { rows = await (await database("reader"))`select student_payload from classroom.published_exercises where slug = ${slug}`; }
  catch { return recovery.exercise; } // committed public-only snapshot; never source fallback
  if (!rows[0]) throw new StudioError(503, "Publication storage is inconsistent.");
  const payload = studentSchema.parse(rows[0].student_payload);
  if (publicChecksum(payload) !== recovery.key) throw new StudioError(503, "Publication storage is inconsistent.");
  return payload;
}

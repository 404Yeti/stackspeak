import "server-only";
import { createHash } from "node:crypto";
import { parseExercises, parseGuides } from "../schema";
import type { ExerciseRecord, TeacherGuide } from "@/features/classroom/types";
import { database } from "./database";
import { draftSchema, guideSchema, projectStudent, type Draft } from "./validation";
import { withPublicationLedger } from "./recovery";
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function seededDraft(e: ExerciseRecord): Draft {
  return draftSchema.parse({ content: { title: e.title, description: e.description, language: e.language,
    difficulty: e.difficulty, topic: e.topics[0] ?? "", topics: e.topics, tags: e.tags, learningObjectives: e.learningObjectives ?? [],
    filename: e.filename, minutes: e.minutes, instructions: e.instructions, readContent: e.readContent ?? "",
    readCode: e.readCode, questions: e.questions, fix: e.fix }, vocabulary: e.vocabulary });
}
function guideFromSeed(g: TeacherGuide) {
  return guideSchema.parse({ idealExplanation: g.answers.map((a) => a.listenFor.join("; ")).join("\n"),
    spokenExplanation: g.answers.map((a) => a.spokenExample).join("\n\n"), expectedSolution: g.correction,
    debuggingGuidance: "", teachingHints: g.notes, followUpQuestions: g.followUps, privateNotes: g.notes.join("\n"),
    answers: g.answers, misunderstandings: g.misunderstandings });
}
function localOnly() {
  const url = new URL(process.env.CLASSROOM_DATABASE_WRITER_URL ?? "invalid:");
  if (process.env.VERCEL || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    throw new Error("Importer currently permits only an isolated local database. Remote imports require separate approval and tooling review.");
}
/** Trusted local CLI boundary. No HTTP handler imports this module. Never overwrites a record or guide. */
export async function importCatalog(input: unknown, privateInput: unknown | undefined, apply = false) {
  localOnly();
  const exercises = parseExercises(input);
  if (privateInput !== undefined && Buffer.byteLength(JSON.stringify(privateInput)) > 48 * 1024) throw new Error("Guide import is too large");
  const guides = privateInput === undefined ? {} : parseGuides(privateInput, exercises);
  const sql = await database("writer");
  const run = async (ledger?: Parameters<Parameters<typeof withPublicationLedger>[0]>[0]) => {
    const activate: ReturnType<typeof projectStudent>[] = [];
    const report = await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(780078)`;
      const planned = [];
      // Preflight every conflict before writing anything; one transaction covers this small seed batch.
      for (const e of exercises) {
        const key = `aud53:${e.id}`;
        const sourceChecksum = hash(e);
        const rows = await tx`select id, slug, import_source, import_checksum, lock_version from classroom.exercises
          where import_source = ${key} or slug = ${e.slug} or legacy_id = ${e.id} for update`;
        const existing = rows[0];
        if (rows.length > 1 || (existing && (existing.import_source !== key || existing.import_checksum !== sourceChecksum || existing.slug !== e.slug)))
          throw new Error(`Import conflict: ${e.slug}. Existing data was not overwritten.`);
        const guide = guides[e.slug] ? guideFromSeed(guides[e.slug]) : undefined;
        const priorGuides = existing ? await tx`select import_checksum from classroom.teacher_guides where exercise_id = ${existing.id}` : [];
        if (guide && !priorGuides[0] && existing && existing.lock_version !== 1)
          throw new Error(`Guide conflict: ${e.slug}. Review the edited exercise in Studio before adding a guide.`);
        if (guide && priorGuides[0] && priorGuides[0].import_checksum !== hash(guide))
          throw new Error(`Guide conflict: ${e.slug}. Existing guide was not overwritten.`);
        planned.push({ e, key, sourceChecksum, existing, guide, guideMissing: !priorGuides[0] });
      }
      const report = [];
      for (const item of planned) {
        const { e, key, sourceChecksum, existing, guide, guideMissing } = item;
        report.push({ slug: e.slug, action: existing ? "skip" : "insert", guide: !guide ? "not-supplied" : guideMissing ? "insert" : "skip" });
        if (!apply) continue;
        let id = existing?.id as string | undefined;
        if (!existing) {
          const draft = seededDraft(e);
          const rows = await tx`insert into classroom.exercises (legacy_id, slug, content, version, import_source, import_checksum)
            values (${e.id}, ${e.slug}, ${tx.json(draft.content)}, ${e.version}, ${key}, ${sourceChecksum}) returning id`;
          id = rows[0].id;
          for (const [position, entry] of draft.vocabulary.entries())
            await tx`insert into classroom.vocabulary (exercise_id, position, entry) values (${id!}, ${position}, ${tx.json(entry)})`;
          if (e.publication === "published" && e.sharing === "public") {
            if (!ledger) throw new Error("Publication ledger required");
            await ledger.deny(e.slug);
            const payload = projectStudent(e.id, e.slug, e.version, draft);
            await tx`insert into classroom.published_exercises (exercise_id, slug, student_payload, version)
              values (${id!}, ${e.slug}, ${tx.json(payload)}, ${e.version})`;
            await tx`update classroom.exercises set publication = 'published', published_at = now(), first_published_at = now(),
              published_checksum = ${hash(draft)} where id = ${id!}`;
            activate.push(payload);
          }
        }
        if (guide && guideMissing) await tx`insert into classroom.teacher_guides (exercise_id, content, import_checksum)
          values (${id!}, ${tx.json(guide)}, ${hash(guide)})`;
        if (guide && guideMissing && existing) await tx`update classroom.exercises set lock_version = lock_version + 1 where id = ${id!}`;
      }
      return report;
    });
    for (const payload of activate) await ledger!.activate(payload);
    return { mode: apply ? "apply" : "dry-run", exercises: report, missingGuides: report.filter((r) => r.guide === "not-supplied").length };
  };
  return apply ? withPublicationLedger(run) : run();
}

import "server-only";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { requireTeacher } from "./auth";
import { parseExercises, parseGuides } from "./schema";
import catalog from "../../../content/classroom/exercises.json";

/** Nothing is loaded at module/build time; no fallback to source-controlled answers. */
export async function privateGuide(slug: string) {
  await requireTeacher();
  const exercises = parseExercises(catalog);
  if (!exercises.some((e) => e.slug === slug))
    return { state: "missing" } as const;
  try {
    let serialized = process.env.CLASSROOM_GUIDES_JSON;
    const path = process.env.CLASSROOM_GUIDES_FILE;
    if (!serialized && path && !process.env.VERCEL && isAbsolute(path)) {
      serialized = await readFile(path, "utf8");
    }
    if (!serialized || Buffer.byteLength(serialized, "utf8") > 48 * 1024)
      return { state: "unavailable" } as const;
    const guide = parseGuides(JSON.parse(serialized), exercises)[slug];
    return guide
      ? ({ state: "available", guide } as const)
      : ({ state: "unavailable" } as const);
  } catch {
    // Do not log private values, JSON parser excerpts, or local paths.
    return { state: "unavailable" } as const;
  }
}

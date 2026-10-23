import "server-only";
import { isTeacher } from "../auth";
import { StudioError } from "./errors";

/** Reuse the existing owner session at both request and data-access boundaries. */
export async function authorizeTeacher() {
  if (!(await isTeacher()))
    throw new StudioError(401, "Sign in to use Classroom Studio.");
}

import { Button } from "@/components/ui/Button";
import { PipMascot } from "@/components/ui/PipMascot";
import { authConfig } from "@/lib/classroom/auth";
import { ClassroomHeader } from "@/features/classroom/ClassroomHeader";
import { connection } from "next/server";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();
  const configured = !!authConfig();
  const error = (await searchParams).error;
  return (
    <div>
      <ClassroomHeader />
      <section className="mx-auto max-w-md px-6 py-16">
        <PipMascot expression="explaining" size={80} alt="" />
        <p className="mt-4 text-sm font-medium text-accent-soft">
          STACKSPEAK CLASSROOM
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          A little preparation.
          <br />A great conversation.
        </h1>
        <p className="mt-4 text-text-muted">
          Sign in to open your exercise library and private teaching guides.
        </p>
        {configured ? (
          <form
            action="/classroom/session"
            method="post"
            className="mt-8 space-y-4"
          >
            <label htmlFor="password" className="block text-sm font-medium">
              Teacher password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              className="classroom-input w-full"
            />
            {error && (
              <p role="alert" className="text-sm text-error">
                That password wasn’t recognized. Please try again.
              </p>
            )}
            <Button type="submit" className="w-full">
              Open Classroom
            </Button>
            <p className="text-xs text-text-muted">
              Owner access · Your session lasts up to eight hours.
            </p>
          </form>
        ) : (
          <p
            role="status"
            className="mt-8 rounded-lg border border-border-subtle bg-surface p-5 text-text-muted"
          >
            Teacher access hasn’t been configured for this environment. Ask the
            workspace owner to set it up.
          </p>
        )}
      </section>
    </div>
  );
}

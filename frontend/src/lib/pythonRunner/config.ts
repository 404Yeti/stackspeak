import { parseRunnerUrl } from "./client";

export type PythonRunnerConfig = { enabled: false } | { enabled: true; runnerUrl: string };

/**
 * The Python runner is OFF unless explicitly enabled AND pointed at a valid runner origin.
 * (PR 2 will read this to decide whether to render a Run button; production stays off until the
 * release gates in docs/python-runner.md pass.)
 */
export function getPythonRunnerConfig(
  env: { enabled?: string; url?: string } = {
    enabled: process.env.NEXT_PUBLIC_PYTHON_RUNNER_ENABLED,
    url: process.env.NEXT_PUBLIC_PYTHON_RUNNER_URL,
  },
): PythonRunnerConfig {
  if (env.enabled !== "true" || !env.url) return { enabled: false };
  try {
    parseRunnerUrl(env.url);
  } catch {
    return { enabled: false };
  }
  return { enabled: true, runnerUrl: env.url };
}

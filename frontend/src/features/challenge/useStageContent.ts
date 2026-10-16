"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";

type Result<T> = { data?: T; error?: ApiError };

/**
 * Lazily fetches one stage's content the first time `enabled` becomes true
 * (so e.g. the review endpoint is never requested before Feedback), keeps it
 * for the rest of the session, and exposes Retry after a failure.
 */
export function useStageContent<T>(
  enabled: boolean,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [result, setResult] = useState<Result<T>>({});
  const [attempt, setAttempt] = useState(0);
  const hasData = result.data !== undefined;

  useEffect(() => {
    if (!enabled || hasData) return;
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => setResult({ data }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({
          error:
            error instanceof ApiError ? error : new ApiError("network", "Could not reach the server."),
        });
      },
    );
    return () => controller.abort();
  }, [enabled, hasData, load, attempt]);

  const retry = useCallback(() => {
    setResult({});
    setAttempt((n) => n + 1);
  }, []);

  return {
    data: result.data,
    error: result.error,
    loading: enabled && result.data === undefined && result.error === undefined,
    retry,
  };
}

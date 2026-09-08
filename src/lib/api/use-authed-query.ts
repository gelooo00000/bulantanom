"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-context";

type QueryState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Fetches data from the Django API using the authenticated user's access
 * token. Shared by the Farmer and LGU sections so loading / error / retry
 * behaviour is identical everywhere.
 */
export function useAuthedQuery<T>(
  fetcher: (accessToken: string) => Promise<T>,
  deps: unknown[] = [],
): QueryState<T> {
  const { accessToken } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((a) => a + 1);
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    // Async IIFE so no setState runs synchronously in the effect body.
    let cancelled = false;
    (async () => {
      try {
        const result = await fetcher(accessToken);
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `fetcher` is intentionally excluded: callers pass inline closures, so
    // including it would refetch on every render. `attempt` drives retries
    // and `deps` lets callers refetch on their own inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, attempt, ...deps]);

  return {
    data,
    // Derived rather than stored. `loading` starts true so the first fetch
    // shows a spinner, but with no token the effect never runs and never
    // clears it — which previously left callers spinning forever instead of
    // rendering an empty or error state. Deriving it fixes that without a
    // setState inside the effect body.
    loading: loading && Boolean(accessToken),
    error,
    refetch,
  };
}

/** @deprecated Use `useAuthedQuery` — kept so LGU pages keep working. */
export const useLguQuery = useAuthedQuery;

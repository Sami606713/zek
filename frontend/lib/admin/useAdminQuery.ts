"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";

type Result<T> = { key: string; data?: T; error?: Error };

/**
 * Loads admin data and reloads whenever `key` changes (put filters and paging in it).
 * While a new key loads, the previous data stays visible so tables don't flash empty.
 */
export function useAdminQuery<T>(key: string, fetcher: () => Promise<T>) {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result<T>>({ key: "" });
  const [lastData, setLastData] = useState<T | undefined>(undefined);
  const fullKey = `${key}#${nonce}`;

  useEffect(() => {
    let alive = true;
    fetcherRef.current().then(
      (data) => {
        if (!alive) return;
        setResult({ key: fullKey, data });
        setLastData(data);
      },
      (error: Error) => alive && setResult({ key: fullKey, error }),
    );
    return () => {
      alive = false;
    };
  }, [fullKey]);

  const done = result.key === fullKey;
  return {
    data: done ? (result.data ?? lastData) : lastData,
    error: done ? result.error : undefined,
    /** True until the first load finishes; use `refreshing` for later reloads. */
    loading: !done && lastData === undefined,
    refreshing: !done && lastData !== undefined,
    refetch: useCallback(() => setNonce((n) => n + 1), []),
  };
}

/** A friendly message for any failed admin call. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Please log in again.";
    if (error.status === 403) return "Your account doesn't have permission for this.";
    if (error.status === 404) return "This item no longer exists.";
    if (error.status === 429) return "Too many requests. Wait a moment and try again.";
    // 503 carries a useful reason (e.g. image storage not set up); other 5xx don't.
    if (error.status === 503 && !error.message.startsWith("Request failed")) return error.message;
    if (error.status >= 500) return "The server had a problem. Please try again.";
    return error.message;
  }
  if (error instanceof TypeError) return "Can't reach the server. Check that the backend is running.";
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Runs a save/delete action with a toast for the result.
 * Resolves to true when it succeeded (deletes return no data, so success is a flag),
 * false when it failed (the error is already shown).
 */
export function useAdminAction() {
  const [pending, setPending] = useState(false);
  const run = useCallback(async (action: () => Promise<unknown>, success?: string): Promise<boolean> => {
    setPending(true);
    try {
      await action();
      if (success) toast.success(success);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setPending(false);
    }
  }, []);
  return { run, pending };
}

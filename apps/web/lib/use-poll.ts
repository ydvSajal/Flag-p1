'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, isApiError } from './api';

type Poll<T> = { data: T | null; error: ApiError | null; loading: boolean; reload: () => Promise<void> };

/** Loads once, then every `ms` while `ms` is a number (null = no polling). Keeps the last data on a failed refresh. */
export const usePoll = <T,>(fetcher: () => Promise<T>, ms: number | null): Poll<T> => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(fetcher);
  useEffect(() => {
    fetchRef.current = fetcher;
  });

  const reload = useCallback(async () => {
    try {
      setData(await fetchRef.current());
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e : new ApiError(0, 'unknown', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (ms === null) return;
    const t = window.setInterval(() => void reload(), ms);
    return () => window.clearInterval(t);
  }, [ms, reload]);

  return { data, error, loading, reload };
};

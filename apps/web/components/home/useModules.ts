'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIMITS, type ModuleKey, type ModulesResponse } from '@picklab/shared';
import { api, isApiError } from '@/lib/api';

const SEEN_KEY = 'pl_seen_modules';

const readSeen = (): string[] | null => {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
};
const writeSeen = (keys: string[]) => {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(keys));
  } catch {
    /* storage blocked: no "New" memory, nothing breaks */
  }
};

/** Modules for home: loads, refreshes on focus and every 15 s, tracks which ones are newly open. */
export const useModules = () => {
  const router = useRouter();
  const [data, setData] = useState<ModulesResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [fresh, setFresh] = useState<Set<ModuleKey>>(new Set());
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getModules();
      if (!res.votingEnabled) return router.replace('/app/paused');
      const keys = res.modules.map((m) => m.key);
      known.current ??= new Set(readSeen() ?? keys);
      const added = keys.filter((k) => !known.current?.has(k));
      if (added.length) {
        setFresh((f) => new Set([...f, ...added]));
        added.forEach((k) => known.current?.add(k));
      }
      writeSeen([...new Set([...(readSeen() ?? []), ...keys])]);
      setData(res);
      setFailed(false);
    } catch (e) {
      if (isApiError(e, 'consent_required')) return router.replace('/start');
      setFailed(true);
    }
  }, [router]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), LIMITS.flagRefreshMs);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  return { data, failed, fresh, reload: load };
};

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ResponseItem, SessionDetail, SetView } from '@picklab/shared';
import { api, isApiError } from '@/lib/api';
import { useFlags } from '@/lib/flags';
import { submitSetResult } from '@/lib/session';
import { useToast } from '@/components/ui/toast';

export type VotingState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; session: SessionDetail; current: SetView | null; doneCount: number; announcement: string };

const preload = (sets: SetView[]) => {
  for (const s of sets)
    for (const v of s.variants)
      if (v.imageUrl) {
        const img = new Image();
        img.src = v.imageUrl;
      }
};

/**
 * Optimistic voting: show the next set at once, save in the background (retry in api.ts),
 * keep two sets ahead. Server `/next` is only asked after pending saves settle, so it never repeats a set.
 */
export const useVoting = (sessionId: string) => {
  const router = useRouter();
  const toast = useToast();
  const { votingEnabled } = useFlags();
  const [state, setState] = useState<VotingState>({ status: 'loading' });
  const [queue, setQueue] = useState<SetView[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const sessionRef = useRef<SessionDetail | null>(null);
  const seen = useRef(new Set<string>());
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const shownAt = useRef(0);
  const answered = useRef(new Set<string>());
  const refilling = useRef(false);

  const goTo = useCallback(
    (e: unknown): boolean => {
      if (isApiError(e, 'voting_paused')) router.replace('/app/paused');
      else if (isApiError(e, 'module_off')) router.replace('/app?msg=module_off');
      else if (isApiError(e, 'session_closed')) router.replace(`/app/session/${sessionId}/done`);
      else if (isApiError(e, 'consent_required')) router.replace('/start');
      else return false;
      return true;
    },
    [router, sessionId],
  );

  const refill = useCallback(async () => {
    if (refilling.current) return;
    refilling.current = true;
    try {
      await pending.current;
      const res = await api.getNextSets(sessionId);
      const fresh = res.sets.filter((s) => !seen.current.has(s.id));
      fresh.forEach((s) => seen.current.add(s.id));
      preload(fresh);
      setQueue((q) => [...q, ...fresh]);
    } catch (e) {
      if (!goTo(e)) toast.show('Could not load the next set', { tone: 'error' });
    } finally {
      refilling.current = false;
    }
  }, [goTo, sessionId, toast]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const session = await api.getSession(sessionId);
        if (session.completed) return router.replace(`/app/session/${sessionId}/done`);
        const next = await api.getNextSets(sessionId);
        if (!live) return;
        if (next.sets.length === 0) return router.replace(`/app/session/${sessionId}/done`);
        sessionRef.current = session;
        next.sets.forEach((s) => seen.current.add(s.id));
        preload(next.sets);
        setDoneCount(next.doneCount);
        setQueue(next.sets);
        shownAt.current = performance.now();
        setState({ status: 'ready', session, current: null, doneCount: next.doneCount, announcement: '' });
      } catch (e) {
        if (live && !goTo(e)) setState({ status: 'error', message: isApiError(e, 'not_found') ? 'That session is gone.' : 'Could not load this session.' });
      }
    })();
    return () => {
      live = false;
    };
  }, [sessionId, router, goTo]);

  // Kill switch: SDK hint, plus an API poll that also works in local mode.
  useEffect(() => {
    if (votingEnabled === false) router.replace('/app/paused');
    const t = window.setInterval(() => {
      api.getModules().then((m) => !m.votingEnabled && router.replace('/app/paused')).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(t);
  }, [votingEnabled, router]);

  const save = useCallback(
    (body: Parameters<typeof submitSetResult>[0]) => {
      const run = submitSetResult(body)
        .then((res) => {
          if (res.sessionComplete) router.replace(`/app/session/${sessionId}/done`);
        })
        .catch((e: unknown) => {
          if (goTo(e)) return;
          toast.show("Couldn't save that pick", { tone: 'error', ms: 12_000, action: { label: 'Retry', onClick: () => save(body) } });
        });
      pending.current = run;
    },
    [goTo, router, sessionId, toast],
  );

  const answer = useCallback(
    (responses: ResponseItem[]) => {
      const set = queue[0];
      const session = sessionRef.current;
      if (!set || !session || answered.current.has(set.id)) return; // double tap guard
      answered.current.add(set.id);
      save({
        id: crypto.randomUUID(),
        sessionId,
        setId: set.id,
        durationMs: Math.min(600_000, Math.round(performance.now() - shownAt.current)),
        responses,
      });
      const done = doneCount + 1;
      setDoneCount(done);
      setAnnouncement(`Pick saved, set ${Math.min(done + 1, session.targetCount)} of ${session.targetCount}`);
      setQueue((q) => q.slice(1));
      shownAt.current = performance.now();
      if (done < session.targetCount) void refill();
    },
    [queue, doneCount, save, sessionId, refill],
  );

  if (state.status !== 'ready') return { state, answer, finishing: false };
  const current = queue[0] ?? null;
  const finishing = doneCount >= state.session.targetCount;
  return { state: { ...state, current: finishing ? null : current, doneCount, announcement }, answer, finishing };
};

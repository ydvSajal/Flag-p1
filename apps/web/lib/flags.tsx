'use client';

import flagsmith from '@flagsmith/flagsmith';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  FLAG_VOTING_ENABLED,
  LIMITS,
  MODULES,
  MODULE_FLAG,
  layoutSchema,
  type Layout,
  type Me,
  type ModuleKey,
} from '@picklab/shared';
import { api, type ApiError, isApiError } from './api';

/** Local mode (LOCAL-DEV.md): no env key, so no SDK at all. */
export const isLocalMode = !process.env.NEXT_PUBLIC_FLAGSMITH_ENV_KEY;

const LAYOUT_KEY = 'pl_dev_layout';

const safeStorage = {
  get: (k: string): string | null => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string): void => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* storage blocked: the layout simply is not remembered */
    }
  },
};

/** Local mode layout: ?layout= (persisted) > NEXT_PUBLIC_DEV_LAYOUT > grid. */
export const localLayout = (): Layout => {
  const candidates = [safeStorage.get(LAYOUT_KEY), process.env.NEXT_PUBLIC_DEV_LAYOUT];
  for (const c of candidates) {
    const parsed = layoutSchema.safeParse(c);
    if (parsed.success) return parsed.data;
  }
  return 'grid';
};

const captureLayoutParam = () => {
  const parsed = layoutSchema.safeParse(new URLSearchParams(window.location.search).get('layout'));
  if (parsed.success) safeStorage.set(LAYOUT_KEY, parsed.data);
};

type FlagsState = {
  me: Me | null;
  meError: ApiError | null;
  /** True once identity is known and (real mode) flags were identified. */
  ready: boolean;
  /** UI hint from the SDK. null = unknown (local mode: use GET /api/modules.votingEnabled). The API is the authority. */
  votingEnabled: boolean | null;
  /** UI hints from the SDK per module. Empty in local mode. The API decides what is shown. */
  moduleFlags: Partial<Record<ModuleKey, boolean>>;
  /** Re-reads /api/me (after consent or login). */
  reloadMe: () => Promise<void>;
  /** Re-fetch flags now (focus, manual). No-op in local mode. */
  refreshFlags: () => Promise<void>;
};

const FlagsContext = createContext<FlagsState | null>(null);

export const useFlags = (): FlagsState => {
  const ctx = useContext(FlagsContext);
  if (!ctx) throw new Error('useFlags needs FlagsProvider');
  return ctx;
};

let initPromise: Promise<void> | null = null;

const initSdk = (): Promise<void> => {
  initPromise ??= flagsmith.init({
    environmentID: process.env.NEXT_PUBLIC_FLAGSMITH_ENV_KEY ?? '',
    api: process.env.NEXT_PUBLIC_FLAGSMITH_API,
    enableEvents: true,
    eventProcessorConfig: { eventsApiUrl: process.env.NEXT_PUBLIC_FLAGSMITH_EVENTS_URL },
    cacheFlags: true,
    // Default flag handler: voting stays on, the experiment falls back to the control (grid).
    defaultFlags: {
      [FLAG_VOTING_ENABLED]: { enabled: true, value: null },
      voting_layout: { enabled: false, value: null },
    },
  });
  return initPromise;
};

const readHints = () => ({
  votingEnabled: flagsmith.hasFeature(FLAG_VOTING_ENABLED, { skipAnalytics: true }),
  moduleFlags: Object.fromEntries(
    MODULES.map((m) => [m, flagsmith.hasFeature(MODULE_FLAG[m], { skipAnalytics: true })]),
  ) as Partial<Record<ModuleKey, boolean>>,
});

export const FlagsProvider = ({ children }: { children: ReactNode }) => {
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<ApiError | null>(null);
  const [ready, setReady] = useState(false);
  const [hints, setHints] = useState<Pick<FlagsState, 'votingEnabled' | 'moduleFlags'>>({
    votingEnabled: null,
    moduleFlags: {},
  });

  const reloadMe = useCallback(async () => {
    try {
      setMe(await api.getMe());
      setMeError(null);
    } catch (e) {
      setMeError(isApiError(e) ? e : null);
    }
  }, []);

  useEffect(() => {
    if (isLocalMode) captureLayoutParam();
    void reloadMe();
  }, [reloadMe]);

  const identity = me?.id;
  const role = me?.role;
  const wave = me?.wave;

  useEffect(() => {
    if (!identity || !role || !wave) {
      setReady(!!meError);
      return;
    }
    if (isLocalMode) {
      setReady(true);
      return;
    }
    let cancelled = false;
    const onFocus = () => void flagsmith.getFlags();
    const onHide = () => void flagsmith.flushEvents();
    void (async () => {
      try {
        await initSdk();
        await flagsmith.identify(identity, { role, wave }); // before any flag read
      } catch {
        /* Flagsmith unreachable: defaultFlags apply, voting stays on, layout is grid */
      }
      if (cancelled) return;
      setHints(readHints());
      setReady(true);
      flagsmith.startListening(LIMITS.flagRefreshMs);
    })();
    window.addEventListener('focus', onFocus);
    window.addEventListener('pagehide', onHide);
    const poll = window.setInterval(() => setHints(readHints()), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pagehide', onHide);
      flagsmith.stopListening();
    };
  }, [identity, role, wave, meError]);

  const refreshFlags = useCallback(async () => {
    if (!isLocalMode) await flagsmith.getFlags();
  }, []);

  const value = useMemo<FlagsState>(
    () => ({ me, meError, ready, ...hints, reloadMe, refreshFlags }),
    [me, meError, ready, hints, reloadMe, refreshFlags],
  );

  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
};

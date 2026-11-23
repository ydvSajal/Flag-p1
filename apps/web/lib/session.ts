import flagsmith from '@flagsmith/flagsmith';
import {
  EVENT_SESSION_COMPLETED,
  FLAG_VOTING_LAYOUT,
  layoutFromVariant,
  type Layout,
  type ModuleKey,
  type Session,
  type SetResultBody,
  type SetResultResponse,
} from '@picklab/shared';
import { api } from './api';
import { isLocalMode, localLayout } from './flags';

/**
 * THE ONLY place the experiment flag is read (D6). Reading it records the exposure, so it
 * happens once per session start. Everything after this renders `session.layout`, never the flag.
 */
const readLayout = (): Layout => {
  if (isLocalMode) return localLayout();
  const flag = flagsmith.getExperimentFlag(FLAG_VOTING_LAYOUT);
  return layoutFromVariant(flag?.variant, flag?.enabled ?? false);
};

export const startSession = (module: ModuleKey): Promise<Session> =>
  api.createSession({ module, layout: readLayout() });

/** Saves one set (retries live in api.ts). On the last set, sends session_completed and flushes. */
export const submitSetResult = async (body: SetResultBody): Promise<SetResultResponse> => {
  const res = await api.submitSetResult(body);
  if (res.sessionComplete) await completeSession();
  return res;
};

export const completeSession = async (): Promise<void> => {
  if (isLocalMode) return;
  try {
    flagsmith.trackEvent(EVENT_SESSION_COMPLETED);
    await flagsmith.flushEvents();
  } catch {
    /* analytics must never block the visitor */
  }
};

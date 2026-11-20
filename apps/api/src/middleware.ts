import type { Context, MiddlewareHandler } from 'hono';
import type { Role } from '@picklab/shared';
import type { z } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type CurrentUser = {
  id: string;
  role: Role;
  wave: number;
  consentedAt: Date | null;
  isAnonymous: boolean;
  email: string | null;
  name: string;
  isAdmin: boolean;
};

export type AppEnv = { Variables: { user: CurrentUser | null } };
export type Ctx = Context<AppEnv>;

export const parseBody = async <S extends z.ZodType>(c: Ctx, schema: S): Promise<z.infer<S>> => {
  const json: unknown = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new HttpError(400, 'invalid_body', parsed.error.issues[0]?.message ?? 'Invalid body');
  return parsed.data;
};

export const requireUser = (c: Ctx): CurrentUser => {
  const user = c.get('user');
  if (!user) throw new HttpError(401, 'unauthenticated', 'Sign in or open /api/me first');
  return user;
};

export const requireCreator = (c: Ctx): CurrentUser => {
  const user = requireUser(c);
  if (user.role !== 'creator') throw new HttpError(403, 'forbidden', 'Creators only');
  return user;
};

/** Admin routes are invisible to everyone else (TRD 9). */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')?.isAdmin) throw new HttpError(404, 'not_found', 'Not found');
  await next();
};

/**
 * In-memory sliding window per user (TRD 5: 60 set results / 20 uploads per minute).
 * ponytail: single-instance memory; move to the database if the API ever runs more than one instance.
 */
export const rateLimiter = (limit: number, now: () => Date) => {
  const hits = new Map<string, number[]>();
  return (userId: string, count = 1): void => {
    const t = now().getTime();
    const recent = (hits.get(userId) ?? []).filter((at) => at > t - 60_000);
    if (recent.length + count > limit) {
      hits.set(userId, recent);
      throw new HttpError(429, 'rate_limited', 'Too many requests, try again in a minute');
    }
    hits.set(userId, [...recent, ...Array<number>(count).fill(t)]);
  };
};

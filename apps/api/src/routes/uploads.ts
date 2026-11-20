import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { LIMITS, uploadSignBodySchema, type UploadSignResponse } from '@picklab/shared';
import type { Deps } from '../app';
import { HttpError, parseBody, rateLimiter, requireCreator, requireUser, type AppEnv } from '../middleware';
import { EXT_BY_TYPE, KEY_PATTERN, readLocal, TYPE_BY_EXT, writeLocal } from '../storage';

const checkFile = (contentType: string, size: number): void => {
  if (!(LIMITS.uploadTypes as readonly string[]).includes(contentType)) {
    throw new HttpError(415, 'unsupported_type', 'Use png, jpg or webp');
  }
  if (size > LIMITS.uploadMaxBytes) throw new HttpError(413, 'file_too_large', 'Files must be 5 MB or less');
};

export const uploadsRoutes = (deps: Deps) => {
  const r = new Hono<AppEnv>();
  const limit = rateLimiter(LIMITS.uploadsPerMinute, deps.now);

  r.post('/uploads/sign', async (c) => {
    const u = requireCreator(c);
    const body = await parseBody(c, uploadSignBodySchema);
    body.files.forEach((f) => checkFile(f.contentType, f.size));
    limit(u.id, body.files.length);
    const uploads = await Promise.all(
      body.files.map(async (f) => {
        const key = `u/${u.id}/${randomUUID()}.${EXT_BY_TYPE[f.contentType]}`;
        return { key, putUrl: await deps.storage.signPut(key, f.contentType, f.size) };
      }),
    );
    return c.json({ uploads } satisfies UploadSignResponse);
  });

  // Local stand-in for R2 (LOCAL-DEV.md): only mounted when R2 is not configured.
  const dir = deps.storage.localDir;
  if (dir) {
    r.put('/uploads/local/*', async (c) => {
      const u = requireUser(c);
      const key = c.req.path.replace(/^\/api\/uploads\/local\//, '');
      if (!KEY_PATTERN.test(key) || !key.startsWith(`u/${u.id}/`)) throw new HttpError(403, 'forbidden', 'Not your key');
      const body = await c.req.arrayBuffer();
      checkFile(c.req.header('content-type') ?? '', body.byteLength);
      await writeLocal(dir, key, body);
      return c.body(null, 200);
    });

    r.get('/uploads/local/*', async (c) => {
      const key = c.req.path.replace(/^\/api\/uploads\/local\//, '');
      if (!KEY_PATTERN.test(key)) throw new HttpError(404, 'not_found', 'Not found');
      const file = await readLocal(dir, key).catch(() => null);
      if (!file) throw new HttpError(404, 'not_found', 'Not found');
      return c.body(new Uint8Array(file), 200, {
        'content-type': TYPE_BY_EXT[key.split('.').pop() ?? ''] ?? 'application/octet-stream',
        'cache-control': 'public, max-age=31536000, immutable',
      });
    });
  }

  return r;
};

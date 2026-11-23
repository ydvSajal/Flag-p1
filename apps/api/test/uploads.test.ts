import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { uploadSignResponseSchema } from '@picklab/shared';
import { describe, expect, it } from 'vitest';
import { diskStorage } from '../src/storage';
import { as, makeApp, makeUser } from './helpers';

const MB = 1024 * 1024;
const png = (size = MB) => ({ contentType: 'image/png', size });

describe('POST /api/uploads/sign', () => {
  it('A-35 creator signs 3 png files', async () => {
    const t = await makeApp();
    const u = await makeUser(t.db, { role: 'creator', email: 'c@picklab.test' });
    const r = await t.req('POST', '/api/uploads/sign', { ...as(u), body: { files: [png(), png(), png()] } });
    const { uploads } = r.parse(uploadSignResponseSchema);
    expect(uploads).toHaveLength(3);
    for (const up of uploads) {
      expect(up.key.startsWith(`u/${u.id}/`)).toBe(true);
      expect(up.putUrl).toMatch(/^https:\/\//);
    }
  });

  it('A-36 guest is 403 forbidden', async () => {
    const t = await makeApp();
    const u = await makeUser(t.db);
    const r = await t.req('POST', '/api/uploads/sign', { ...as(u), body: { files: [png()] } });
    expect([r.status, r.code]).toEqual([403, 'forbidden']);
  });

  it('A-37 gif is 415, 6 MB is 413, 5 files is 400', async () => {
    const t = await makeApp();
    const u = await makeUser(t.db, { role: 'creator', email: 'c@picklab.test' });
    const sign = (files: unknown[]) => t.req('POST', '/api/uploads/sign', { ...as(u), body: { files } });
    expect((await sign([{ contentType: 'image/gif', size: MB }])).status).toBe(415);
    expect((await sign([png(6 * MB)])).status).toBe(413);
    expect((await sign([png(), png(), png(), png(), png()])).status).toBe(400);
  });

  it('local stand-in: PUT then GET serves the file; other prefixes are refused', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'picklab-up-'));
    const t = await makeApp({ storage: diskStorage(dir) });
    const u = await makeUser(t.db, { role: 'creator', email: 'c@picklab.test' });
    const { uploads } = (await t.req('POST', '/api/uploads/sign', { ...as(u), body: { files: [png(4)] } })).parse(
      uploadSignResponseSchema,
    );
    const up = uploads[0];
    expect(up?.putUrl).toBe(`/api/uploads/local/${up?.key}`);
    const put = await t.app.request(up?.putUrl ?? '', {
      method: 'PUT',
      headers: { 'content-type': 'image/png', 'x-test-user': u.id },
      body: new Uint8Array([1, 2, 3, 4]),
    });
    expect(put.status).toBe(200);
    const get = await t.app.request(up?.putUrl ?? '');
    expect(get.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
    const stranger = await makeUser(t.db, { role: 'creator', email: 's@picklab.test' });
    const steal = await t.app.request(up?.putUrl ?? '', {
      method: 'PUT',
      headers: { 'content-type': 'image/png', 'x-test-user': stranger.id },
      body: new Uint8Array([9]),
    });
    expect(steal.status).toBe(403);
  });
});

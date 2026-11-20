/** Tiny cookie-jar client over Node's global fetch. One instance = one browser. */
export type Res = { status: number; json: any; ok: boolean };

export const makeClient = (base: string) => {
  const jar = new Map<string, string>();
  const request = async (method: string, path: string, body?: unknown, raw?: { bytes: Uint8Array; type: string }): Promise<Res> => {
    const url = path.startsWith('http') ? path : base.replace(/\/$/, '') + path;
    const headers: Record<string, string> = { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
    let payload: string | Uint8Array | undefined;
    if (raw) {
      headers['content-type'] = raw.type;
      payload = raw.bytes;
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(url, { method, headers, body: payload as any });
    for (const sc of res.headers.getSetCookie()) {
      const [pair = ''] = sc.split(';');
      const i = pair.indexOf('=');
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // non-JSON body
    }
    return { status: res.status, json, ok: res.ok };
  };
  return {
    jar,
    get: (p: string) => request('GET', p),
    post: (p: string, b?: unknown) => request('POST', p, b ?? {}),
    put: (p: string, bytes: Uint8Array, type: string) => request('PUT', p, undefined, { bytes, type }),
  };
};
export type Client = ReturnType<typeof makeClient>;

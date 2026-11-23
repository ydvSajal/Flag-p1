import {
  consentResponseSchema,
  createSetResponseSchema,
  errorBodySchema,
  liveResponseSchema,
  meSchema,
  modulesResponseSchema,
  mySetsResponseSchema,
  nextSetsResponseSchema,
  overviewResponseSchema,
  sessionDetailSchema,
  sessionSchema,
  setResultResponseSchema,
  setResultsResponseSchema,
  uploadSignResponseSchema,
  type CreateSessionBody,
  type CreateSetBody,
  type LiveResponse,
  type Me,
  type ModulesResponse,
  type MySetsResponse,
  type NextSetsResponse,
  type OverviewResponse,
  type Session,
  type SessionDetail,
  type SetResultBody,
  type SetResultResponse,
  type SetResultsResponse,
  type UploadSignBody,
  type UploadSignResponse,
} from '@picklab/shared';

/** Typed failure: HTTP status plus the API error code (TRD 5). status 0 = network failure. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const isApiError = (e: unknown, code?: string): e is ApiError =>
  e instanceof ApiError && (code === undefined || e.code === code);

type Parser<T> = { parse: (data: unknown) => T };

const request = async <T>(method: string, path: string, parser: Parser<T> | null, body?: unknown): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the server');
  }

  if (!res.ok) {
    const parsed = errorBodySchema.safeParse(await res.json().catch(() => null));
    throw parsed.success
      ? new ApiError(res.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiError(res.status, 'unknown', `Request failed (${res.status})`);
  }
  if (!parser) return undefined as T;
  try {
    return parser.parse(await res.json());
  } catch {
    throw new ApiError(res.status, 'bad_response', 'Unexpected response from the server');
  }
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Retries transient failures (network, 429, 5xx except the 503 kill switch). Safe only for idempotent calls. */
const withRetry = async <T>(fn: () => Promise<T>, attempts = 3, baseMs = 400): Promise<T> => {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const transient = e instanceof ApiError && (e.status === 0 || e.status === 429 || (e.status >= 500 && e.code !== 'voting_paused'));
      if (!transient || i >= attempts) throw e;
      await sleep(baseMs * 2 ** (i - 1));
    }
  }
};

const enc = encodeURIComponent;

export const api = {
  /* me */
  getMe: (): Promise<Me> => request('GET', '/me', meSchema),
  consent: () => request('POST', '/me/consent', consentResponseSchema, {}),
  deleteMe: (): Promise<void> => request('DELETE', '/me', null),

  /* tester */
  getModules: (): Promise<ModulesResponse> => request('GET', '/modules', modulesResponseSchema),
  createSession: (body: CreateSessionBody): Promise<Session> => request('POST', '/sessions', sessionSchema, body),
  getSession: (id: string): Promise<SessionDetail> => request('GET', `/sessions/${enc(id)}`, sessionDetailSchema),
  getNextSets: (id: string): Promise<NextSetsResponse> =>
    request('GET', `/sessions/${enc(id)}/next`, nextSetsResponseSchema),
  /** Idempotent by `body.id`, so it retries 3x with backoff. */
  submitSetResult: (body: SetResultBody): Promise<SetResultResponse> =>
    withRetry(() => request('POST', '/set-results', setResultResponseSchema, body)),

  /* creator */
  signUploads: (body: UploadSignBody): Promise<UploadSignResponse> =>
    request('POST', '/uploads/sign', uploadSignResponseSchema, body),
  createSet: (body: CreateSetBody): Promise<{ id: string }> => request('POST', '/sets', createSetResponseSchema, body),
  getMySets: (): Promise<MySetsResponse> => request('GET', '/sets/mine', mySetsResponseSchema),
  getSetResults: (id: string): Promise<SetResultsResponse> =>
    request('GET', `/sets/${enc(id)}/results`, setResultsResponseSchema),
  deleteSet: (id: string): Promise<void> => request('DELETE', `/sets/${enc(id)}`, null),

  /* admin */
  getAdminLive: (): Promise<LiveResponse> => request('GET', '/admin/live', liveResponseSchema),
  getAdminOverview: (): Promise<OverviewResponse> => request('GET', '/admin/overview', overviewResponseSchema),

  /** Local mode only (LOCAL-DEV.md): upgrades the current guest to a creator. */
  devLogin: (email: string): Promise<void> => request('POST', '/auth/dev-login', null, { email }),
};

/** PUT a file to a URL from `signUploads` (relative local URL or R2). Throws ApiError on failure. */
export const putUpload = async (putUrl: string, file: Blob, contentType: string): Promise<void> => {
  let res: Response;
  try {
    res = await fetch(putUrl, { method: 'PUT', body: file, headers: { 'content-type': contentType }, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'network', 'Upload failed, check your connection');
  }
  if (!res.ok) throw new ApiError(res.status, 'upload_failed', 'Upload failed');
};

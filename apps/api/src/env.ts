import { z } from 'zod';

const DEV_SECRET = 'picklab-local-dev-secret-not-for-production';

/** Empty strings in .env mean "not set", so the local stand-in is used (LOCAL-DEV.md). */
const opt = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().default(3001),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: opt,
  BETTER_AUTH_SECRET: opt,
  BETTER_AUTH_URL: z.string().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: opt,
  GOOGLE_CLIENT_SECRET: opt,
  FLAGSMITH_SERVER_KEY: opt,
  FLAGSMITH_API_URL: z.string().default('http://localhost:8000/api/v1/'),
  FLAGSMITH_DASHBOARD_URL: z.string().default('http://localhost:8000'),
  R2_ACCOUNT_ID: opt,
  R2_ACCESS_KEY_ID: opt,
  R2_SECRET_ACCESS_KEY: opt,
  R2_BUCKET: z.string().default('picklab-uploads'),
  R2_PUBLIC_BASE_URL: opt,
  ADMIN_EMAILS: z.string().default(''),
  ALLOW_DEV_LOGIN: opt,
});

export type Env = z.infer<typeof envSchema> & { secret: string; isProduction: boolean; adminEmails: string[] };

export const parseEnv = (source: NodeJS.ProcessEnv): Env => {
  const env = envSchema.parse(source);
  const isProduction = env.NODE_ENV === 'production';
  if (isProduction && !env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is required in production');
  return {
    ...env,
    isProduction,
    secret: env.BETTER_AUTH_SECRET ?? DEV_SECRET,
    adminEmails: parseEmails(env.ADMIN_EMAILS),
  };
};

export const parseEmails = (list: string): string[] =>
  list
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

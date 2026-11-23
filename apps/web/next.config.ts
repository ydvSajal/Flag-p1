import type { NextConfig } from 'next';

// One .env at the repo root serves web and API. Already-set variables win. Missing file is fine.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // no root .env: local defaults apply
}

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3001';

const config: NextConfig = {
  transpilePackages: ['@picklab/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

export default config;

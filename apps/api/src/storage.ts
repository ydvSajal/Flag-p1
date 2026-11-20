import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type Storage = {
  signPut: (key: string, contentType: string, size: number) => Promise<string>;
  exists: (key: string) => Promise<boolean>;
  imageUrl: (key: string) => string;
  /** Set only for the local stand-in: uploads are PUT to and served from this folder by the API. */
  localDir?: string;
};

export const EXT_BY_TYPE: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const TYPE_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

/** Keys are `u/<userId>/<uuid>.<ext>`; anything else is refused (also blocks path traversal locally). */
export const KEY_PATTERN = /^u\/[A-Za-z0-9-]+\/[0-9a-f-]{36}\.(png|jpg|webp)$/;

export type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; publicBaseUrl: string };

export const r2Storage = (cfg: R2Config): Storage => {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  return {
    signPut: (key, contentType, size) =>
      getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType, ContentLength: size }),
        { expiresIn: 300 },
      ),
    exists: async (key) => {
      try {
        await s3.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }));
        return true;
      } catch {
        return false;
      }
    },
    imageUrl: (key) => `${cfg.publicBaseUrl.replace(/\/$/, '')}/${key}`,
  };
};

/** Local stand-in (LOCAL-DEV.md): same-origin URLs, files under `dir`. */
export const diskStorage = (dir: string): Storage => ({
  signPut: async (key) => `/api/uploads/local/${key}`,
  exists: async (key) => {
    try {
      return (await stat(localPath(dir, key))).isFile();
    } catch {
      return false;
    }
  },
  imageUrl: (key) => `/api/uploads/local/${key}`,
  localDir: dir,
});

export const localPath = (dir: string, key: string): string => path.join(dir, ...key.split('/'));

export const writeLocal = async (dir: string, key: string, body: ArrayBuffer): Promise<void> => {
  const file = localPath(dir, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(body));
};

export const readLocal = (dir: string, key: string): Promise<Buffer> => readFile(localPath(dir, key));

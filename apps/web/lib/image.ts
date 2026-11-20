import { LIMITS } from '@picklab/shared';

export const IMAGE_MAX_SIDE = 1600;

export type PreparedImage = { blob: Blob; contentType: string; previewUrl: string };

const toBlob = (canvas: HTMLCanvasElement, type: string): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));

/** Validates, then resizes to max 1600 px (aspect kept) and re-encodes as webp (jpeg fallback). Throws Error with a user-facing message. */
export const prepareImage = async (file: File): Promise<PreparedImage> => {
  if (!(LIMITS.uploadTypes as readonly string[]).includes(file.type)) throw new Error('Use a PNG, JPG or WebP image.');
  if (file.size > LIMITS.uploadMaxBytes) throw new Error('That image is over 5 MB. Pick a smaller one.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That file could not be read as an image.');
  }
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process that image.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = (await toBlob(canvas, 'image/webp')) ?? (await toBlob(canvas, 'image/jpeg'));
  if (!blob) throw new Error('Your browser could not process that image.');
  return { blob, contentType: blob.type, previewUrl: URL.createObjectURL(blob) };
};

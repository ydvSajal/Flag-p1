'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import type { PreparedImage } from '@/lib/image';

type Props = {
  index: number;
  image: PreparedImage | null;
  error?: string;
  onPick: (file: File) => void;
  onRemove: () => void;
};

/** One image option: pick a file, see a preview, remove it. */
export const UploadSlot = ({ index, image, error, onPick, onRemove }: Props) => {
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-sunken">
        {image ? (
          <img src={image.previewUrl} alt={`Option ${index + 1} preview`} className="size-full object-cover" />
        ) : (
          <label htmlFor={id} className="flex size-full cursor-pointer items-center justify-center p-3 text-center text-sm font-bold text-muted">
            Option {index + 1}: choose image
          </label>
        )}
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = '';
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <label
          htmlFor={id}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-line px-4 text-sm font-bold focus-within:outline hover:bg-sunken"
        >
          {image ? 'Replace' : 'Choose'}
        </label>
        <Button variant="ghost" onClick={onRemove} aria-label={`Remove option ${index + 1}`}>
          Remove
        </Button>
      </div>
    </div>
  );
};

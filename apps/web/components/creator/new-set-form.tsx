'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LIMITS, MODULE_KIND, MODULE_LABEL, type ModuleKey } from '@picklab/shared';
import { TextSlot } from '@/components/creator/text-slot';
import { UploadSlot } from '@/components/creator/upload-slot';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { api, isApiError, putUpload } from '@/lib/api';
import { prepareImage, type PreparedImage } from '@/lib/image';

type Slot = { key: number; image: PreparedImage | null; text: string; error?: string };

let nextKey = 1;
const blank = (): Slot => ({ key: nextKey++, image: null, text: '' });
const blanks = () => [blank(), blank()];

export const NewSetForm = ({ modules }: { modules: ModuleKey[] }) => {
  const router = useRouter();
  const [module, setModule] = useState<ModuleKey>(modules[0] ?? 'thumbnails');
  const [title, setTitle] = useState('');
  const [slots, setSlots] = useState<Slot[]>(blanks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = MODULE_KIND[module] === 'image';
  const filled = slots.filter((s) => (isImage ? s.image : s.text.trim()));
  const canPublish = title.trim().length > 0 && filled.length >= LIMITS.optionsMin && !busy;

  const patch = (key: number, p: Partial<Slot>) => setSlots((all) => all.map((s) => (s.key === key ? { ...s, ...p } : s)));
  const remove = (key: number) =>
    setSlots((all) => (all.length > LIMITS.optionsMin ? all.filter((s) => s.key !== key) : all.map((s) => (s.key === key ? { ...blank(), key } : s))));

  const pick = async (key: number, file: File) => {
    try {
      patch(key, { image: await prepareImage(file), error: undefined });
    } catch (e) {
      patch(key, { error: e instanceof Error ? e.message : 'Could not use that image.' });
    }
  };

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const options = isImage
        ? await uploadAll(filled.map((s) => s.image as PreparedImage))
        : filled.map((s) => ({ kind: 'text' as const, text: s.text.trim() }));
      const { id } = await api.createSet({ module, title: title.trim(), options });
      router.push(`/creator/sets/${encodeURIComponent(id)}`);
    } catch (e) {
      setError(isApiError(e) || e instanceof Error ? e.message : 'Could not publish. Try again.');
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canPublish) void publish();
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">What are you posting?</legend>
        <div className="flex flex-wrap gap-2">
          {modules.map((m) => (
            <label key={m} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-line px-4 font-bold has-[:checked]:bg-accent has-[:checked]:text-accent-ink has-[:focus-visible]:outline">
              <input
                type="radio"
                name="module"
                className="sr-only"
                checked={module === m}
                onChange={() => {
                  setModule(m);
                  if (MODULE_KIND[m] !== MODULE_KIND[module]) setSlots(blanks());
                }}
              />
              {MODULE_LABEL[m]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Title" value={title} maxLength={LIMITS.setTitleMax} onChange={(e) => setTitle(e.target.value)} hint={`${title.length} / ${LIMITS.setTitleMax}`} />
      <div className="grid gap-4 sm:grid-cols-2">
        {slots.map((s, i) =>
          isImage ? (
            <UploadSlot key={s.key} index={i} image={s.image} error={s.error} onPick={(f) => void pick(s.key, f)} onRemove={() => remove(s.key)} />
          ) : (
            <TextSlot key={s.key} index={i} value={s.text} onChange={(text) => patch(s.key, { text })} onRemove={() => remove(s.key)} />
          ),
        )}
      </div>
      {slots.length < LIMITS.optionsMax ? (
        <Button variant="secondary" onClick={() => setSlots((a) => [...a, blank()])}>
          Add option
        </Button>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" loading={busy} disabled={!canPublish} className="w-full">
        {filled.length < LIMITS.optionsMin ? `Add at least ${LIMITS.optionsMin} options` : 'Publish'}
      </Button>
    </form>
  );
};

/** Signs, uploads and returns image options. Slots are uploaded in order. */
const uploadAll = async (images: PreparedImage[]) => {
  const { uploads } = await api.signUploads({
    files: images.map((i) => ({ contentType: i.contentType, size: i.blob.size })),
  });
  if (uploads.length !== images.length) throw new Error('Upload setup failed. Try again.');
  await Promise.all(uploads.map((u, i) => putUpload(u.putUrl, images[i]!.blob, images[i]!.contentType)));
  return uploads.map((u) => ({ kind: 'image' as const, imageKey: u.key }));
};

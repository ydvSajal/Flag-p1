import type { VariantView } from '@picklab/shared';
import { cn } from '@/lib/cn';

type Props = {
  variant: VariantView;
  /** Set title, used for alt text. */
  title: string;
  index: number;
  /** Height class for image frames, so every view shows images at the same size. */
  frameClass?: string;
  className?: string;
};

/** Image options keep their aspect ratio (contain on a neutral backdrop). Text is rendered as text, never HTML. */
export const OptionMedia = ({ variant, title, index, frameClass = 'h-44 sm:h-56', className }: Props) => {
  if (variant.kind === 'image' && variant.imageUrl) {
    return (
      <div className={cn('grid w-full place-items-center overflow-hidden rounded-xl bg-sunken', frameClass, className)}>
        <img
          src={variant.imageUrl}
          alt={`${title}, option ${index + 1}`}
          draggable={false}
          className="size-full select-none object-contain"
        />
      </div>
    );
  }
  // Text must never overflow its frame: the frame height is a minimum, not a fixed size.
  const textFrame = frameClass.replace(/(^|\s)((?:[a-z]+:)?)h-/g, '$1$2min-h-');
  return (
    <div className={cn('grid w-full place-items-center rounded-xl bg-sunken px-4 py-6', textFrame, className)}>
      <p className="whitespace-pre-wrap break-words text-center text-lg font-bold leading-snug sm:text-xl">
        {variant.text ?? ''}
      </p>
    </div>
  );
};

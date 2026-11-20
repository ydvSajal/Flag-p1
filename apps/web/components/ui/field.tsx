import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Props = {
  label: string;
  error?: string;
  hint?: string;
  /** Render a textarea instead of an input. */
  multiline?: boolean;
  children?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'children'>;

const controlClass =
  'w-full rounded-2xl border-2 border-line bg-surface px-4 py-3 text-base placeholder:text-muted ' +
  'aria-[invalid=true]:border-bad';

export const Field = ({ label, error, hint, multiline, className, ...rest }: Props) => {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={controlClass}
          {...(rest as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input id={id} aria-invalid={!!error} aria-describedby={describedBy} className={controlClass} {...rest} />
      )}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

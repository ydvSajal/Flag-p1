import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-base font-bold ' +
  'transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink border border-transparent hover:brightness-110',
  secondary: 'bg-surface text-ink border border-line hover:bg-sunken',
  ghost: 'text-ink hover:bg-sunken',
};

/** Class string so links (`next/link`) can look like buttons. */
export const buttonClass = (variant: ButtonVariant = 'primary', extra?: string): string =>
  cn(base, variants[variant], extra);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean };

export const Button = ({ variant = 'primary', loading, disabled, className, children, ...rest }: Props) => (
  <button
    type="button"
    {...rest}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={buttonClass(variant, className)}
  >
    {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
    {children}
  </button>
);

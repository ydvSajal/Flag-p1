export const Progress = ({ value, max, label }: { value: number; max: number; label: string }) => (
  <div
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={value}
    className="h-3 w-full overflow-hidden rounded-full border-2 border-line bg-surface"
  >
    <div
      className="h-full bg-accent transition-[width] duration-300"
      style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }}
    />
  </div>
);

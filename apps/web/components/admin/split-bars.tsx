import { LAYOUTS, type Split } from '@picklab/shared';
import { VIEW_LABEL, viewColor } from '@/components/ui/badge';

/** Actual split of the last hour, one bar per view in its view colour. */
export const SplitBars = ({ split }: { split: Split }) => {
  const total = LAYOUTS.reduce((n, l) => n + split[l], 0);
  return (
    <ul className="space-y-3">
      {LAYOUTS.map((l) => {
        const pct = total > 0 ? Math.round((split[l] / total) * 100) : 0;
        return (
          <li key={l} className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3 text-base font-bold sm:grid-cols-[9rem_1fr_7rem]">
            <span className="truncate">{VIEW_LABEL[l]}</span>
            <div
              role="meter"
              aria-label={`${VIEW_LABEL[l]} share`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="h-6 overflow-hidden rounded-full border-2 border-line bg-sunken"
            >
              <div className="h-full transition-[width] duration-300" style={{ width: `${pct}%`, background: viewColor(l) }} />
            </div>
            <span className="text-right tabular-nums">
              {split[l]} ({pct}%)
            </span>
          </li>
        );
      })}
    </ul>
  );
};

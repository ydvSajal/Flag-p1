import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

type Props = {
  rank: number;
  pct: number;
  positive: number;
  winner: boolean;
  imageUrl?: string;
  text?: string;
};

/** One ranked option with its score bar. Score = (picks + yes) / voters. */
export const ResultBar = ({ rank, pct, positive, winner, imageUrl, text }: Props) => (
  <li className={cn('rounded-chunk border-2 border-line bg-surface p-4', winner && 'border-good shadow-chunk')}>
    <div className="flex items-center gap-3">
      <span className="text-lg font-black tabular-nums">#{rank}</span>
      {winner ? <Badge tone="good">Winner</Badge> : null}
    </div>
    {imageUrl ? (
      <img src={imageUrl} alt={`Option ranked ${rank}`} className="mt-3 max-h-64 w-full rounded-2xl border-2 border-line object-cover" />
    ) : (
      <p className="mt-3 whitespace-pre-wrap break-words font-semibold">{text}</p>
    )}
    <div className="mt-3 flex items-center gap-3">
      <div
        role="meter"
        aria-label={`Score for option ranked ${rank}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-4 flex-1 overflow-hidden rounded-full border-2 border-line bg-sunken"
      >
        <div className={cn('h-full', winner ? 'bg-good' : 'bg-accent')} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-24 text-right text-sm font-extrabold tabular-nums">
        {pct}% ({positive})
      </span>
    </div>
  </li>
);

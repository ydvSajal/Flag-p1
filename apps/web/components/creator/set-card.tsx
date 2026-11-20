import Link from 'next/link';
import { MODULE_LABEL, type MySet } from '@picklab/shared';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

/** Row in "My sets": title, module, voter count, and a strip of previews. */
export const SetCard = ({ set }: { set: MySet }) => (
  <Card className="p-4">
    <Link href={`/creator/sets/${encodeURIComponent(set.id)}`} className="block space-y-3 rounded-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 break-words text-lg font-extrabold">{set.title}</h2>
        <Badge>{MODULE_LABEL[set.module]}</Badge>
      </div>
      <div className="flex gap-2" aria-hidden>
        {set.preview.map((v) =>
          v.imageUrl ? (
            <img key={v.id} src={v.imageUrl} alt="" className="size-14 rounded-xl border-2 border-line object-cover" />
          ) : (
            <span key={v.id} className="line-clamp-2 min-h-14 max-w-32 flex-1 rounded-xl border-2 border-line bg-sunken p-2 text-xs">
              {v.text}
            </span>
          ),
        )}
      </div>
      <p className="text-sm font-bold text-muted">
        {set.voters === 0 ? 'No votes yet' : `${set.voters} ${set.voters === 1 ? 'voter' : 'voters'}`} · View results
      </p>
    </Link>
  </Card>
);

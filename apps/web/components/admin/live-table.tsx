import { MODULE_LABEL, type LiveStatus, type LiveVisitor } from '@picklab/shared';
import { Badge, ViewBadge } from '@/components/ui/badge';

const STATUS: Record<LiveStatus, { label: string; tone: 'good' | 'accent' | 'neutral' }> = {
  finished: { label: 'Finished', tone: 'good' },
  voting: { label: 'Voting', tone: 'accent' },
  dropped: { label: 'Dropped', tone: 'neutral' },
};

const ago = (now: string, then: string): string => {
  const s = Math.max(0, Math.round((Date.parse(now) - Date.parse(then)) / 1000));
  if (Number.isNaN(s)) return '-';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
};

const th = 'px-3 py-2 text-left text-sm font-extrabold uppercase tracking-wide';
const td = 'px-3 py-2.5 text-base';

export const LiveTable = ({ visitors, now }: { visitors: LiveVisitor[]; now: string }) => (
  <div className="overflow-x-auto rounded-chunk border-2 border-line bg-surface">
    <table className="w-full min-w-[40rem] border-collapse">
      <thead className="border-b-2 border-line bg-sunken">
        <tr>
          <th className={th}>Visitor</th>
          <th className={th}>Wave</th>
          <th className={th}>View</th>
          <th className={th}>Module</th>
          <th className={th}>Progress</th>
          <th className={th}>Status</th>
          <th className={th}>Last seen</th>
        </tr>
      </thead>
      <tbody>
        {visitors.map((v, i) => (
          <tr key={`${v.shortId}-${v.module}-${i}`} className="border-t border-line/40">
            <td className={`${td} font-mono font-bold`}>{v.shortId}</td>
            <td className={`${td} tabular-nums`}>{v.wave}</td>
            <td className={td}>
              <ViewBadge layout={v.layout} />
            </td>
            <td className={td}>{MODULE_LABEL[v.module]}</td>
            <td className={`${td} font-bold tabular-nums`}>
              {v.doneCount}/{v.targetCount}
            </td>
            <td className={td}>
              <Badge tone={STATUS[v.status].tone}>{STATUS[v.status].label}</Badge>
            </td>
            <td className={`${td} tabular-nums text-muted`}>{ago(now, v.lastSeenAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

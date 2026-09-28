import { Trophy } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useLeaderboard } from '../lib/data';
import { cx, lkrText, pct, timeAgo, tone } from '../lib/format';
import { Empty, Skeleton } from '../components/ui';

export default function Leaderboard() {
  const rows = useLeaderboard(50);
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Trophy className="h-6 w-6 text-accent" /> Leaderboard
        </h1>
        <p className="text-sm text-muted">Everyone starts with LKR 100,000. Ranked by total return, recalculated after each day's close.</p>
      </div>

      {rows === null ? (
        <Skeleton className="h-96" />
      ) : rows.length === 0 ? (
        <Empty title="No rankings yet">The leaderboard fills in after the first end-of-day update.</Empty>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">#</th>
                <th className="px-4 py-2 text-left font-medium">Trader</th>
                <th className="px-4 py-2 text-right font-medium">Portfolio</th>
                <th className="px-4 py-2 text-right font-medium">Return</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.uid} className={cx('border-t border-line', r.uid === user?.uid && 'bg-brand/10')}>
                  <td className="num px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      {r.photoURL ? (
                        <img src={r.photoURL} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-surface-2" />
                      )}
                      <span className="font-medium">{r.displayName}</span>
                      {r.uid === user?.uid && <span className="text-xs text-brand">you</span>}
                    </span>
                  </td>
                  <td className="num px-4 py-3 text-right">{lkrText(r.equity)}</td>
                  <td className={cx('num px-4 py-3 text-right font-semibold', tone(r.returnPct))}>{pct(r.returnPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">Updated {timeAgo(rows[0].updatedAt)}</p>
        </div>
      )}
    </div>
  );
}

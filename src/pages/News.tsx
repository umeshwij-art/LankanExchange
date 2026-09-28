import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText } from 'lucide-react';
import { fetchNews, type NewsPayload } from '../lib/api';
import { cx, ticker, timeAgo } from '../lib/format';
import { Empty, Segmented, Skeleton } from '../components/ui';
import { useMarket } from '../lib/data';

export default function News() {
  const [data, setData] = useState<NewsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'news' | 'announcements'>('news');
  const { snapshot } = useMarket();

  useEffect(() => {
    fetchNews().then(setData, e => setError(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">News</h1>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'news', label: 'Headlines' },
            { value: 'announcements', label: 'CSE announcements' },
          ]}
        />
      </div>

      {error && <Empty title="News is unavailable">{error}</Empty>}
      {!data && !error && <Skeleton className="h-96" />}

      {data && tab === 'news' && (
        data.news.length === 0 ? (
          <Empty title="No headlines right now">The news feeds didn't respond. Try again later.</Empty>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.news.map(n => (
              <li key={n.link} className="card p-4">
                <a href={n.link} target="_blank" rel="noreferrer" className="group block">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="font-semibold text-brand">{n.source}</span>
                    {n.published && <span>{timeAgo(n.published)}</span>}
                  </div>
                  <h2 className="mt-1 font-semibold leading-snug group-hover:text-brand">
                    {n.title} <ExternalLink className="inline h-3 w-3 text-muted" />
                  </h2>
                  {n.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{n.summary}</p>}
                </a>
              </li>
            ))}
          </ul>
        )
      )}

      {data && tab === 'announcements' && (
        data.announcements.length === 0 ? (
          <Empty title="No announcements loaded">cse.lk didn't return announcements just now.</Empty>
        ) : (
          <ul className="card divide-y divide-line">
            {data.announcements.map(a => {
              const listed = a.symbol && snapshot?.quotes[a.symbol];
              return (
                <li key={a.id} className="flex items-start justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      {listed ? (
                        <Link to={`/stock/${a.symbol}`} className="font-semibold text-brand">{ticker(a.symbol)}</Link>
                      ) : (
                        a.symbol && <span className="font-semibold">{ticker(a.symbol)}</span>
                      )}
                      <span className="rounded bg-surface-2 px-1.5 py-0.5">{a.category}</span>
                      {a.date && <span>{timeAgo(a.date)}</span>}
                    </div>
                    <p className={cx('mt-1', !a.company && 'font-medium')}>{a.company && <span className="font-medium">{a.company}: </span>}{a.title}</p>
                  </div>
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noreferrer" className="btn-ghost shrink-0 px-2 py-1 text-xs">
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
}

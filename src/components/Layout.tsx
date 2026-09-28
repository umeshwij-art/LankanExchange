import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, LogOut, Moon, Newspaper, Search, Sun, Trophy, Wallet, LineChart } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useMarket, usePortfolio } from '../lib/data';
import { cx, money, ticker } from '../lib/format';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--brand)" />
        <path d="M7 22 L13 15 L17 18 L25 9" stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="25" cy="9" r="2.2" fill="var(--accent)" />
      </svg>
      <span>
        CMB<span className="text-brand">EX</span>
      </span>
    </Link>
  );
}

function SymbolSearch() {
  const { quotes } = useMarket();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const needle = q.trim().toUpperCase();
  const hits = needle
    ? quotes.filter(x => x.symbol.startsWith(needle) || x.name.toUpperCase().includes(needle)).slice(0, 8)
    : [];

  const go = (symbol: string) => {
    setQ('');
    setOpen(false);
    nav(`/stock/${symbol}`);
  };

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        className="input pl-9"
        placeholder="Search JKH, Commercial Bank…"
        value={q}
        onChange={e => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => e.key === 'Enter' && hits[0] && go(hits[0].symbol)}
        aria-label="Search securities"
      />
      {open && hits.length > 0 && (
        <ul className="card absolute z-50 mt-1 w-full overflow-hidden shadow-lg">
          {hits.map(h => (
            <li key={h.symbol}>
              <button className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2" onMouseDown={() => go(h.symbol)}>
                <span className="min-w-0">
                  <span className="font-semibold">{ticker(h.symbol)}</span>
                  <span className="ml-2 truncate text-muted">{h.name}</span>
                </span>
                <span className="num text-xs">{money(h.close)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const links = [
  { to: '/', label: 'Markets', icon: LineChart, end: true },
  { to: '/portfolio', label: 'Portfolio', icon: Wallet },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/news', label: 'News', icon: Newspaper },
];

function CashChip() {
  const { account } = usePortfolio();
  if (!account) return null;
  return (
    <Link to="/portfolio" className="hidden rounded-lg bg-surface-2 px-3 py-1.5 text-xs sm:block">
      <span className="text-muted">Cash </span>
      <span className="num font-semibold">LKR {money(account.cash)}</span>
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, login, logout, loading } = useAuth();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    document.title = 'CMBEX — Colombo Stock Exchange trading simulator';
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cx('rounded-lg px-3 py-1.5 text-sm font-medium', isActive ? 'bg-surface-2 text-text' : 'text-muted hover:text-text')
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex flex-1 items-center justify-end gap-2">
            <SymbolSearch />
            <CashChip />
            <button className="btn-ghost px-2.5" onClick={toggle} aria-label="Toggle dark mode">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {!loading &&
              (user ? (
                <button className="btn-ghost px-2.5" onClick={logout} title={`Signed in as ${user.email}`} aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </button>
              ) : (
                <button className="btn-primary whitespace-nowrap" onClick={login}>
                  Sign in
                </button>
              ))}
          </div>
        </div>
        <nav className="flex justify-around border-t border-line md:hidden">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => cx('flex flex-col items-center gap-0.5 px-2 py-2 text-[11px]', isActive ? 'text-brand' : 'text-muted')}
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-line py-6 text-xs text-muted">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 sm:flex-row sm:justify-between">
          <p>Practice trading with play money. Prices are end-of-day closes from cse.lk; not investment advice.</p>
          <p>Not affiliated with the Colombo Stock Exchange.</p>
        </div>
      </footer>
    </div>
  );
}

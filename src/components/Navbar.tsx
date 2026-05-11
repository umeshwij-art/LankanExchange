import * as React from "react";
import { TrendingUp, Search, Home, Newspaper, ArrowUpRight, X, User, CreditCard, LogOut, LogIn, Activity, Sun, Moon, LayoutDashboard, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { useUI } from "../lib/UIContext";

export default function Navbar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved as 'light' | 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  const navigate = useNavigate();
  const { user, profile, login, logout } = useAuth();

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/stocks/search?q=${query}`)
        .then(res => res.json())
        .then(data => {
          setResults(data);
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/stock/${query.trim().toUpperCase()}`);
      setQuery("");
      setResults([]);
    }
  };

  return (
    <nav className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-4 group">
              {/* Heartbeat ECG Effect */}
              <div className="flex items-center h-4 mb-0.5 px-1.5 bg-emerald-500/5 rounded-sm border border-emerald-500/10 backdrop-blur-[2px]">
                <svg width="36" height="12" viewBox="0 0 36 12" className="text-emerald-500 overflow-visible">
                  <path 
                    d="M0 6 H8 L10 2 L13 10 L16 6 H36" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    strokeDasharray="100"
                    strokeDashoffset="100"
                    className="animate-[ecg-pulse_2.5s_ease-in-out_infinite]"
                  />
                </svg>
              </div>

              <span className="font-serif font-semibold text-xl tracking-tight text-foreground flex flex-col leading-none">
                <span>COLOMBO</span>
                <span className="text-[10px] font-sans font-bold text-primary tracking-[0.4em] mt-0.5 uppercase">Exchange</span>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-6 lg:gap-8">
              <Link to="/" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <Home className="h-4 w-4" /> Market
              </Link>
              <Link to="/news" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <Newspaper className="h-4 w-4" /> News
              </Link>
              {user && (
                <>
                  <Link 
                    to="/portfolio"
                    id="portfolio-trigger"
                    className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                  >
                    <LayoutDashboard className="h-4 w-4" /> Portfolio
                  </Link>
                  <Link 
                    to="/community"
                    className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" /> Community Lab
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-muted/50 border border-border/50 text-muted-foreground hover:text-primary hover:bg-muted transition-all"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            <div className="relative group">
              <form onSubmit={handleSearch}>
                <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search symbols..." 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="bg-muted/50 border border-border/50 rounded-lg py-2 pl-11 pr-10 text-sm focus:outline-none focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all w-40 md:w-64 font-medium"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setResults([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </form>

              {query.length >= 2 && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-2xl overflow-hidden z-[100]">
                  {searching ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">Searching...</div>
                  ) : results.length > 0 ? (
                    results.map((res) => (
                      <button
                        key={res.symbol}
                        onClick={() => {
                          navigate(`/stock/${res.symbol}`);
                          setQuery("");
                          setResults([]);
                        }}
                        className="w-full p-3 text-left hover:bg-muted transition-colors border-b border-border last:border-0 flex justify-between items-center group/item"
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-xs text-primary group-hover/item:underline truncate">{res.symbol}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{res.name}</div>
                        </div>
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover/item:text-primary flex-shrink-0" />
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-muted-foreground">No results found</div>
                  )}
                </div>
              )}
            </div>

            {user ? (
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="h-9 w-9 rounded-full border border-border overflow-hidden hover:ring-4 hover:ring-primary/10 transition-all"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ''} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-full w-full bg-primary/10 flex items-center justify-center text-primary">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-2xl z-50 py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-4 py-3 border-b border-border mb-1">
                        <div className="text-xs font-bold truncate">{user.displayName || 'User'}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
                        {profile?.tier === 'pro' && (
                          <div className="mt-1.5 inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-600 text-[8px] font-bold uppercase tracking-widest">
                            Pro Member
                          </div>
                        )}
                      </div>
                      <Link 
                        to="/profile" 
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-muted transition-colors"
                      >
                        <User className="h-4 w-4 text-muted-foreground" /> Profile
                      </Link>
                      <Link 
                        to="/billing" 
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-muted transition-colors"
                      >
                        <CreditCard className="h-4 w-4 text-muted-foreground" /> Billing
                      </Link>
                      <button 
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors border-t border-border mt-1"
                      >
                        <LogOut className="h-4 w-4" /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button 
                onClick={login}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                <LogIn className="h-4 w-4" /> Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

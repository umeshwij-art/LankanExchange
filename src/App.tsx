import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './lib/auth';
import { MarketProvider } from './lib/data';
import { ThemeProvider, useTheme } from './lib/theme';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Empty } from './components/ui';
import Markets from './pages/Markets';
import Stock from './pages/Stock';
import Portfolio from './pages/Portfolio';
import Leaderboard from './pages/Leaderboard';
import Learn from './pages/Learn';
import News from './pages/News';

function Toasts() {
  const { theme } = useTheme();
  return <Toaster position="bottom-center" richColors theme={theme} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <MarketProvider>
            <BrowserRouter>
              <Toasts />
              <Layout>
                <Routes>
                  <Route path="/" element={<Markets />} />
                  <Route path="/stock/:symbol" element={<Stock />} />
                  <Route path="/portfolio" element={<Portfolio />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/learn" element={<Learn />} />
                  <Route path="/news" element={<News />} />
                  <Route
                    path="*"
                    element={
                      <Empty title="Page not found">
                        <Link to="/" className="text-brand underline">Back to markets</Link>
                      </Empty>
                    }
                  />
                </Routes>
              </Layout>
            </BrowserRouter>
          </MarketProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

import * as React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import { PortfolioBanner } from "./components/PortfolioBanner";
import Home from "./pages/Home";
import StockDetail from "./pages/StockDetail";
import News from "./pages/News";
import Portfolio from "./pages/Portfolio";
import Community from "./pages/Community";
import Profile from "./pages/Profile";
import Billing from "./pages/Billing";
import { AuthProvider } from "./lib/AuthContext";
import { UIProvider } from "./lib/UIContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { HelmetProvider } from 'react-helmet-async';
import DividendDetail from "./pages/DividendDetail";
import { Toaster } from "sonner";
import { InvestorInduction } from "./components/InvestorInduction";
import { Joyride, Step } from "react-joyride";

const TOUR_STEPS: Step[] = [
  {
    target: '#main-chart',
    content: 'Welcome to the SAMP Bank trading desk. Monitor the Colombo Exchange pulse and analyze the ASPI in real-time.',
  },
  {
    target: '#terminal-feed',
    content: 'Use the Intel Terminal to access AI-powered disclosures and deep-dives on your favorite listed entities.',
  },
  {
    target: '#trading-desk',
    content: 'Execute mock trades through our institutional-grade simulator to refine your investment strategy.',
  },
  {
    target: '#portfolio-trigger',
    content: 'Track your holdings and dividends in your virtual portfolio context at any time.',
  }
];

const JoyrideComponent = Joyride as any;

export default function App() {
  const [runTour, setRunTour] = React.useState(false);

  React.useEffect(() => {
    const hasSeenTour = sessionStorage.getItem('colombo_exchange_tour');
    if (!hasSeenTour) {
      setRunTour(true);
    }
  }, []);

  const handleTourCallback = (data: any) => {
    const { status } = data;
    if (['finished', 'skipped'].includes(status)) {
      sessionStorage.setItem('colombo_exchange_tour', 'true');
      setRunTour(false);
    }
  };

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <AuthProvider>
          <UIProvider>
            <Router>
            <div className="min-h-screen flex flex-col pt-8">
              <JoyrideComponent 
                steps={TOUR_STEPS} 
                run={runTour} 
                continuous 
                showSkipButton 
                callback={handleTourCallback}
                styles={{
                  options: {
                    primaryColor: '#0055FF',
                    zIndex: 10000,
                  }
                }}
              />
              <InvestorInduction />
              <Toaster position="bottom-center" richColors />
            <div className="fixed top-0 left-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.2em] py-2 text-center z-[100] shadow-md border-b border-white/10">
              SIMULATED DATA: Colombo Exchange Training Platform • Institutional Feed • {new Date().toLocaleDateString()}
            </div>
            <Navbar />
            <PortfolioBanner />
            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/news" element={<News />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/community" element={<Community />} />
                <Route path="/stock/:symbol" element={<StockDetail />} />
                <Route path="/stocks/:symbol/dividend/:year" element={<DividendDetail />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/billing" element={<Billing />} />
              </Routes>
            </main>
            <footer className="border-t border-border py-8 bg-card">
              <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-xs font-bold uppercase tracking-widest opacity-40">
                  © 2026 Colombo Exchange • Data provided by CSE.lk & Daily FT
                </div>
                <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                  <span>Market Rules</span>
                  <span>Privacy Policy</span>
                  <span>API Documentation</span>
                </div>
              </div>
            </footer>
          </div>
        </Router>
      </UIProvider>
    </AuthProvider>
  </HelmetProvider>
</ErrorBoundary>
);
}

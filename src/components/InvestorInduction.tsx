import React, { useState, useEffect } from 'react';
import { ShieldCheck, Signature, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';

export function InvestorInduction() {
  const [isOpen, setIsOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [alias, setAlias] = useState('');
  const { profile } = useAuth();

  useEffect(() => {
    const hasBeenInducted = sessionStorage.getItem('colombo_exchange_inducted');
    if (!hasBeenInducted) {
      setIsOpen(true);
    }
  }, []);

  const handleInduction = () => {
    if (acknowledged && alias.trim()) {
      sessionStorage.setItem('colombo_exchange_inducted', 'true');
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={cn(
            "relative w-full max-w-2xl bg-card border-4 border-double border-primary/20 p-8 shadow-2xl",
            "after:absolute after:inset-1 after:border after:border-primary/10 after:pointer-events-none"
          )}
        >
          {/* Decorative Corner Elements */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/40" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary/40" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary/40" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/40" />

          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="bg-primary/10 p-4 rounded-full">
                <ShieldCheck className="h-12 w-12 text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-serif font-bold tracking-tight text-primary uppercase">Colombo Exchange Investor Honor Code</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">Colombo Exchange • Verification Department</p>
            </div>

            <div className="border-y border-primary/10 py-8 px-4 space-y-4">
              <p className="text-sm leading-relaxed italic text-muted-foreground">
                "By entering this exchange, I affirm my intent to engage in the simulation of financial markets for educational and training purposes. I understand that the values, transactions, and holdings displayed herein are simulations and carry no real-world fiscal liability."
              </p>
              
              <div className="flex items-start gap-3 text-left">
                <div className="pt-1">
                  <button 
                    onClick={() => setAcknowledged(!acknowledged)}
                    className={cn(
                      "h-5 w-5 border-2 rounded transition-all flex items-center justify-center",
                      acknowledged ? "bg-primary border-primary" : "border-muted-foreground"
                    )}
                  >
                    {acknowledged && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                  </button>
                </div>
                <label className="text-xs font-semibold uppercase tracking-wider cursor-pointer" onClick={() => setAcknowledged(!acknowledged)}>
                  I acknowledge that Colombo Exchange is a training platform and simulator.
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end pt-4">
              <div className="text-left space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Investor Alias / Signature</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter full name or alias"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    className="w-full bg-transparent border-b border-muted-foreground/40 py-2 font-serif italic text-xl focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/20"
                  />
                  <Signature className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                </div>
              </div>

              <button
                disabled={!acknowledged || !alias.trim()}
                onClick={handleInduction}
                className={cn(
                  "w-full py-4 rounded font-bold uppercase tracking-[0.2em] text-xs transition-all",
                  acknowledged && alias.trim() 
                    ? "bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95" 
                    : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                )}
              >
                Accept Admission
              </button>
            </div>

            <p className="text-[9px] text-muted-foreground uppercase tracking-widest pt-4">
              Electronic Signature ID: {profile?.uid?.slice(0, 8) || 'GUEST-' + Math.random().toString(36).substr(2, 6)}
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

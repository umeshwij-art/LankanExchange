import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { User, Shield, Star, Calendar, Mail, Check, X, Zap, Crown, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function Profile() {
  const { profile, loading, logout, updateProfile } = useAuth();
  const [showPricing, setShowPricing] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState<{[key: string]: 'idle' | 'loading' | 'success'}>({});

  const handleWaitlist = async (tier: string) => {
    if (!profile?.email) return;
    setWaitlistStatus(prev => ({ ...prev, [tier]: 'loading' }));
    try {
      await setDoc(doc(db, 'waitlist', profile.email), {
        email: profile.email,
        tier: tier,
        createdAt: new Date().toISOString()
      });
      setWaitlistStatus(prev => ({ ...prev, [tier]: 'success' }));
    } catch (error) {
      console.error("Waitlist error:", error);
      setWaitlistStatus(prev => ({ ...prev, [tier]: 'idle' }));
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Skeleton className="h-32 w-full mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Please sign in to view your profile</h2>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-primary p-8 text-white flex flex-col md:flex-row items-center gap-6">
          <div className="h-24 w-24 rounded-full border-4 border-white/20 overflow-hidden bg-white/10 flex items-center justify-center">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt={profile.displayName || ''} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User className="h-12 w-12 opacity-50" />
            )}
          </div>
          <div className="text-center md:text-left flex-grow">
            <h1 className="text-3xl font-bold tracking-tight">{profile.displayName || 'Stock Trader'}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-none font-bold uppercase tracking-widest text-[10px]">
                {profile.tier === 'ultimate' ? <Crown className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" /> : 
                 profile.tier === 'pro' ? <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" /> : 
                 <Shield className="h-3 w-3 mr-1" />}
                {profile.tier} Member
              </Badge>
              {profile.role === 'admin' && (
                <Badge className="bg-red-500 text-white border-none font-bold uppercase tracking-widest text-[10px]">
                  Admin
                </Badge>
              )}
              <span className="text-white/60 text-xs font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Joined {new Date(profile.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <button 
            onClick={logout}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors border border-white/10"
          >
            Sign Out
          </button>
        </div>

        {/* Content */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Account Details</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase">Email Address</div>
                    <div className="text-sm font-medium">{profile.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase">Account Status</div>
                    <div className="text-sm font-medium">Verified & Active</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Subscription</h3>
              <div className="p-4 rounded-xl border border-border bg-muted/30">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-bold text-lg capitalize">{profile.tier} Plan</div>
                    <div className="text-xs text-muted-foreground">Next renewal: N/A</div>
                  </div>
                  {profile.tier === 'free' && (
                    <button 
                      onClick={() => setShowPricing(true)}
                      className="px-3 py-1 bg-primary text-white text-[10px] font-bold uppercase tracking-widest rounded-md hover:bg-primary/90 transition-all"
                    >
                      Upgrade
                    </button>
                  )}
                </div>
                {profile.role === 'admin' && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg shadow-sm">
                    <div className="text-[10px] font-bold text-red-600 uppercase mb-2 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Admin Dev Tools
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => updateProfile({ tier: 'free' })}
                        className="flex-1 py-1.5 bg-red-600 text-white text-[8px] font-bold uppercase tracking-widest rounded-md hover:bg-red-700 transition-colors"
                      >
                        Free
                      </button>
                      <button 
                        onClick={() => updateProfile({ tier: 'pro' })}
                        className="flex-1 py-1.5 bg-red-600 text-white text-[8px] font-bold uppercase tracking-widest rounded-md hover:bg-red-700 transition-colors"
                      >
                        Pro
                      </button>
                      <button 
                        onClick={() => updateProfile({ tier: 'ultimate' })}
                        className="flex-1 py-1.5 bg-red-600 text-white text-[8px] font-bold uppercase tracking-widest rounded-md hover:bg-red-700 transition-colors"
                      >
                        Ultimate
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {profile.tier === 'free' 
                    ? "You are currently on the free plan. Upgrade to Pro for real-time alerts, advanced technical indicators, and exportable reports."
                    : profile.tier === 'pro'
                    ? "You have full access to professional features, including real-time market depth and advanced screening tools."
                    : "You are on the Ultimate plan. All features unlocked, including multi-broker sync and pro screener."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Portfolio (Manual Entry)</h3>
              <div className="p-4 rounded-xl border border-border bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground mb-4">Track your holdings manually in this beta version.</p>
                <button className="w-full py-2 border border-dashed border-primary/40 text-primary text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-primary/5 transition-all">
                  + Add Position
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Trading Activity</h3>
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-border flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider">Watchlist Items</span>
                  <span className="font-mono font-bold">{profile.watchlist?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Modal */}
      <AnimatePresence>
        {showPricing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPricing(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-card border border-border rounded-3xl overflow-hidden shadow-2xl my-8"
            >
              <button 
                onClick={() => setShowPricing(false)}
                className="absolute right-6 top-6 p-2 hover:bg-muted rounded-full transition-colors z-10"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-3">
                {/* Free Plan */}
                <div className="p-10 border-r border-border">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Basic</div>
                  <h3 className="text-3xl font-bold mb-4">Free</h3>
                  <div className="text-4xl font-bold mb-8">LKR 0<span className="text-sm text-muted-foreground font-normal">/mo</span></div>
                  
                  <ul className="space-y-4 mb-10">
                    {[
                      'Simulated OHLC data',
                      '1 Watchlist allowed',
                      'Basic line charts',
                      'Public market news'
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <Check className="h-4 w-4 text-green-500" /> {feature}
                      </li>
                    ))}
                  </ul>

                  <button 
                    disabled
                    className="w-full py-4 bg-muted text-muted-foreground rounded-2xl font-bold text-sm cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                </div>

                {/* Pro Plan */}
                <div className="p-10 border-r border-border bg-primary/5 relative">
                  <div className="absolute top-10 right-10">
                    <Badge className="bg-primary text-white border-none font-bold uppercase tracking-widest text-[8px]">Most Popular</Badge>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-2">Professional</div>
                  <h3 className="text-3xl font-bold mb-4">Pro</h3>
                  <div className="text-4xl font-bold mb-8">LKR 2,750<span className="text-sm text-muted-foreground font-normal">/mo</span></div>
                  
                  <ul className="space-y-4 mb-10">
                    {[
                      'Real-time (Coming Soon)',
                      'AI Disclosure Summaries',
                      'WhatsApp Price Alerts',
                      'Advanced Charting Tools',
                      'Priority Support'
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <Check className="h-4 w-4 text-primary" /> {feature}
                      </li>
                    ))}
                  </ul>

                  <button 
                    onClick={() => handleWaitlist('pro')}
                    disabled={waitlistStatus['pro'] === 'loading' || waitlistStatus['pro'] === 'success'}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
                  >
                    {waitlistStatus['pro'] === 'loading' ? 'Joining...' : 
                     waitlistStatus['pro'] === 'success' ? 'On Waitlist!' : 'Join Waitlist'}
                  </button>
                </div>

                {/* Ultimate Plan */}
                <div className="p-10 bg-black text-white relative">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Enterprise</div>
                  <h3 className="text-3xl font-bold mb-4">Ultimate</h3>
                  <div className="text-4xl font-bold mb-8">LKR 6,950<span className="text-sm text-white/40 font-normal">/mo</span></div>
                  
                  <ul className="space-y-4 mb-10">
                    {[
                      'Everything in Pro',
                      'Multi-broker Sync',
                      'Pro Screener (Advanced)',
                      'Custom API Access',
                      '1-on-1 Strategy Call'
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <Crown className="h-4 w-4 text-yellow-400/40" /> {feature}
                      </li>
                    ))}
                  </ul>

                  <button 
                    onClick={() => handleWaitlist('ultimate')}
                    disabled={waitlistStatus['ultimate'] === 'loading' || waitlistStatus['ultimate'] === 'success'}
                    className="w-full py-4 bg-white text-black rounded-2xl font-bold text-sm hover:bg-white/90 transition-all shadow-xl shadow-white/10"
                  >
                    {waitlistStatus['ultimate'] === 'loading' ? 'Joining...' : 
                     waitlistStatus['ultimate'] === 'success' ? 'On Waitlist!' : 'Join Waitlist'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

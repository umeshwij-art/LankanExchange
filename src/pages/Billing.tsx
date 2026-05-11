import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { CreditCard, MapPin, Globe, Save, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Billing() {
  const { profile, loading, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    address: profile?.billing?.address || '',
    country: profile?.billing?.country || 'Sri Lanka',
  });

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Skeleton className="h-12 w-48 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Please sign in to manage billing</h2>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    
    try {
      await updateProfile({
        billing: {
          ...formData,
          updatedAt: new Date().toISOString(),
        }
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update billing:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your payment methods and billing information.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> Billing Address
            </h3>
            
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Street Address</label>
                <input 
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="123 Galle Road, Colombo"
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Country</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select 
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      className="w-full bg-muted/50 border border-border rounded-xl pl-12 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none transition-all"
                    >
                      <option value="Sri Lanka">Sri Lanka</option>
                      <option value="India">India</option>
                      <option value="Singapore">Singapore</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="United States">United States</option>
                    </select>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={saving}
                className="w-full md:w-auto px-8 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Saving...' : success ? 'Saved Successfully' : 'Save Changes'}
              </button>
            </form>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Payment Method
            </h3>
            <div className="p-6 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center py-12">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="font-bold mb-1">No payment method added</div>
              <p className="text-xs text-muted-foreground max-w-[200px]">Add a credit or debit card to upgrade to Pro features.</p>
              <button className="mt-6 px-6 py-2 bg-muted hover:bg-muted/80 rounded-lg text-xs font-bold transition-colors">
                Add Card
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Summary */}
        <div className="space-y-6">
          <div className="bg-primary text-white rounded-2xl p-8 shadow-lg">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-2">Current Plan</div>
            <h2 className="text-3xl font-bold capitalize mb-4">{profile.tier}</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-2 text-xs font-medium">
                <CheckCircle2 className="h-4 w-4 text-white/40" /> Basic market data
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <CheckCircle2 className="h-4 w-4 text-white/40" /> 5 watchlist items
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <CheckCircle2 className="h-4 w-4 text-white/40" /> Daily news updates
              </div>
            </div>

            {profile.tier === 'free' && (
              <button className="w-full py-3 bg-white text-primary rounded-xl font-bold text-sm hover:bg-white/90 transition-all">
                Upgrade to Pro
              </button>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-widest mb-4">Invoices</h4>
            <div className="text-center py-8 text-muted-foreground text-xs italic">
              No invoices found.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

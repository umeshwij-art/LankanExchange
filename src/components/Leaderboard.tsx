import React, { useEffect, useState } from 'react';
import { db, collection, query, orderBy, limit, getDocs, OperationType, handleFirestoreError } from '../lib/firebase';
import { Trophy, TrendingUp, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/AuthContext';

interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  roi: number;
  virtualBalance: number;
}

export const Leaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // We fetch the leaderboard regardless of auth, but handleFirestoreError 
    // will give us context if it fails due to being unauthenticated.
    const fetchLeaderboard = async () => {
      if (authLoading) return;
      
      try {
        const q = query(
          collection(db, 'users'),
          orderBy('roi', 'desc'),
          limit(10)
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as LeaderboardEntry[];
        setEntries(data);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        // Only throw if it's a critical logic failure, otherwise just log the context
        try {
          handleFirestoreError(error, OperationType.LIST, 'users');
        } catch (e) {
          // Error is already logged by handler
        }
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [authLoading]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          key={entry.uid}
          className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
            index === 0 ? 'bg-yellow-500/10 border-yellow-500/20' : 
            index === 1 ? 'bg-slate-400/10 border-slate-400/20' :
            index === 2 ? 'bg-amber-600/10 border-amber-600/20' :
            'bg-card border-border hover:border-primary/30'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-8 flex justify-center font-mono font-bold text-lg text-muted-foreground">
              {index === 0 ? <Trophy className="h-5 w-5 text-yellow-500" /> : index + 1}
            </div>
            <div className="h-10 w-10 rounded-full bg-muted overflow-hidden border-2 border-background">
              {entry.photoURL ? (
                <img src={entry.photoURL} alt={entry.displayName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                  <UserIcon className="h-5 w-5" />
                </div>
              )}
            </div>
            <div>
              <div className="font-bold text-sm">{entry.displayName || 'Anonymous Trader'}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                LKR {entry.virtualBalance.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`font-mono font-bold ${entry.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {entry.roi >= 0 ? '+' : ''}{entry.roi.toFixed(2)}%
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1 justify-end">
              <TrendingUp className="h-3 w-3" /> ROI
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

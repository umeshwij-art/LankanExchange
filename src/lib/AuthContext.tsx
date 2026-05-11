import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  onSnapshot,
  User,
  OperationType,
  handleFirestoreError
} from './firebase';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  tier: 'free' | 'pro' | 'ultimate';
  role: 'user' | 'admin';
  createdAt: string;
  availableCash: number;
  reservedCash: number;
  totalRealizedPL: number;
  watchlist: string[];
  billing?: {
    address?: string;
    country?: string;
    updatedAt?: string;
  };
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        // Real-time listener for profile
        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
            
            // Migration: Add missing fields to existing profiles
            const needsMigration = !data.role || !data.tier || data.availableCash === undefined || data.reservedCash === undefined || data.totalRealizedPL === undefined;
            if (needsMigration) {
              const updates: any = {};
              if (!data.role) updates.role = currentUser.email === 'umeshwij@gmail.com' ? 'admin' : 'user';
              if (!data.tier) updates.tier = 'free';
              if (data.availableCash === undefined) updates.availableCash = (data as any).virtualBalance ?? 1000000;
              if (data.reservedCash === undefined) updates.reservedCash = 0;
              if (data.totalRealizedPL === undefined) updates.totalRealizedPL = 0;
              if (!data.watchlist) updates.watchlist = [];

              updateDoc(userDocRef, updates).catch(err => console.error("Migration failed:", err));
            }
          } else {
            // Initialize profile if it doesn't exist
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              tier: 'free',
              role: currentUser.email === 'umeshwij@gmail.com' ? 'admin' : 'user',
              createdAt: new Date().toISOString(),
              availableCash: 1000000,
              reservedCash: 0,
              totalRealizedPL: 0,
              watchlist: []
            };
            setDoc(userDocRef, newProfile).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${currentUser.uid}`));
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      // Use merge: true to avoid overwriting the entire document if profile state is slightly stale
      await setDoc(userDocRef, updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

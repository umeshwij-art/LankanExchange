import React, { createContext, useContext, useState, ReactNode } from 'react';

interface UIContextType {
  activeTicker: string | null;
  setActiveTicker: (ticker: string | null) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [activeTicker, setActiveTicker] = useState<string | null>(null);

  return (
    <UIContext.Provider value={{ activeTicker, setActiveTicker }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}

'use client';

import React, { createContext, useContext, useEffect } from 'react';

interface ThemeContextType {
  isDashboardRoute: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Always force dark mode on ALL pages (landing, auth, dashboard)
    const root = document.documentElement;
    root.classList.add('dark');
    // Remove any light mode class if it exists
    root.classList.remove('light');
  }, []);

  return (
    <ThemeContext.Provider value={{ isDashboardRoute: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}


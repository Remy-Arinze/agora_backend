'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDashboardRoute: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  
  // Check if current route is a dashboard route
  // Default to false if pathname is not available (SSR or initial load)
  const isDashboardRoute = typeof pathname === 'string' && pathname.startsWith('/dashboard');

  useEffect(() => {
    setMounted(true);
    // Check localStorage or system preference
    const savedTheme = localStorage.getItem('theme') as Theme;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setThemeState(initialTheme);
  }, []);

  // Apply theme based on route
  useEffect(() => {
    if (!mounted) return;
    
    const root = document.documentElement;
    
    if (isDashboardRoute) {
      // On dashboard routes, apply user's theme preference
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else {
      // On non-dashboard routes (landing, auth), always force light mode
      root.classList.remove('dark');
    }
  }, [mounted, isDashboardRoute, theme]);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    // Only save theme preference if on dashboard route
    // This ensures theme preference is scoped to dashboards
    if (isDashboardRoute) {
      localStorage.setItem('theme', newTheme);
      applyTheme(newTheme);
    }
  };

  const toggleTheme = () => {
    // Only allow theme toggle on dashboard routes
    if (!isDashboardRoute) return;
    
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isDashboardRoute }}>
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


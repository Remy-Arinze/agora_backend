import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // Ensure column span classes are always generated
    'lg:col-span-3',
    'lg:col-span-4',
    'lg:col-span-5',
    'lg:col-span-6',
    'lg:col-span-7',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Agora Brand Colors
        'agora-blue': '#2490FD',
        'agora-success': '#36FE96',
        'agora-text': '#02173D',
        'agora-accent': '#FF532A',
        
        // Light Mode - using CSS variables from globals.css (hex values)
        'light-bg': '#e5e7eb',
        'light-card': 'var(--light-card)',
        'light-text-primary': 'var(--light-text-primary)',
        'light-text-secondary': 'var(--light-text-secondary)',
        'light-text-muted': 'var(--light-text-muted)',
        'light-border': '#f3f4f6', // Direct hex value - matches gray-100
        
        // Dark Mode - using CSS variables from globals.css (hex values)
        'dark-bg': 'var(--dark-bg)',
        'dark-surface': 'var(--dark-surface)',
        'dark-border': 'var(--dark-border)',
        'dark-hover': 'var(--dark-hover)',
        'dark-text-primary': 'var(--dark-text-primary)',
        'dark-text-secondary': 'var(--dark-text-secondary)',
        'dark-text-muted': 'var(--dark-text-muted)',
        
        // Override default Tailwind colors with Agora brand colors
        blue: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2490FD', // Agora blue
          600: '#2490FD', // Agora blue
          700: '#1e7ae6',
          800: '#1e6bd1',
          900: '#1e5bbd',
        },
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#36FE96', // Agora success
          600: '#36FE96', // Agora success
          700: '#2ee67d',
          800: '#2bd164',
          900: '#28bc4b',
        },
      },
    },
  },
  safelist: [
    // Ensure column span classes are always generated
    'lg:col-span-3',
    'lg:col-span-4',
    'lg:col-span-5',
    'lg:col-span-6',
    'lg:col-span-7',
  ],
  plugins: [],
};
export default config;


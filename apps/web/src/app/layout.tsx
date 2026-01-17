import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import StoreProvider from '@/lib/store/StoreProvider';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Toaster } from 'react-hot-toast';

const acuminPro = localFont({
  src: [
    {
      path: '../../public/assets/fonts/Acumin-RPro.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/assets/fonts/Acumin-ItPro.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../../public/assets/fonts/Acumin-BdPro.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../public/assets/fonts/Acumin-BdItPro.otf',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-acumin-pro',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Agora - Digital Education Identity',
  description: 'Multi-Tenant Digital Public Infrastructure for Education',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={acuminPro.variable}>
        <ThemeProvider>
          <StoreProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--light-card)',
                  color: 'var(--light-text-primary)',
                },
                success: {
                  iconTheme: {
                    primary: '#2490FD', // Agora blue
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


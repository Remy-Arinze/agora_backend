import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import StoreProvider from '@/lib/store/StoreProvider';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Toaster } from 'react-hot-toast';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.agora-schools.com'),
  title: {
    default: 'Agora | Global Student Identity Ledger & School Management System',
    template: '%s | Agora'
  },
  description: 'Agora creates a borderless academic identity for every student, turning static paper trails into a living, portable digital profile secured by a global student ledger.',
  keywords: [
    'Digital Student Identity', 
    'Global Student Ledger', 
    'School Management System', 
    'Digital Transcripts', 
    'Academic Identity', 
    'Verified Education Records', 
    'EdTech Africa',
    'Student Data Portability',
    'Immutable Academic Records',
    'Blockchain Education Registry'
  ],
  authors: [{ name: 'Agora Team' }],
  creator: 'Agora',
  publisher: 'Agora',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.agora-schools.com',
    siteName: 'Agora',
    title: 'Agora - The Digital Chain-of-Trust for Education',
    description: 'A borderless academic identity for every student. Secured, portable, and immutable records on a global ledger.',
    images: [
      {
        url: '/assets/logos/agora_main.png',
        width: 1200,
        height: 630,
        alt: 'Agora - Digital Education Identity',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agora - Digital Education Identity',
    description: 'Transforming traditional transcripts into a lifelong asset. Verified, immutable, and instantly accessible student data.',
    images: ['/assets/logos/agora_main.png'],
  },
  icons: {
    icon: [
      { url: '/assets/favicon.ico' },
      { url: '/assets/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/assets/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/assets/apple-touch-icon.png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        {/* Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Agora',
              url: 'https://www.agora-schools.com',
              logo: 'https://www.agora-schools.com/assets/logos/agora_main.png',
              description: 'Agora creates a borderless academic identity for every student, anchoring educational history in a global student ledger.',
              sameAs: [
                'https://twitter.com/agora_edu',
                'https://linkedin.com/company/agora-edu'
              ]
            })
          }}
        />
        {/* Service/Product Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Service',
              name: 'Agora Student Identity Ledger',
              provider: {
                '@type': 'Organization',
                name: 'Agora'
              },
              description: 'A unified management system that turns static paper trails into a living, portable digital profile for students.',
              areaServed: 'Global',
              serviceType: 'Education Management'
            })
          }}
        />
      </head>
      <body className={montserrat.variable}>
        <ThemeProvider>
          <StoreProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--dark-surface)',
                  color: 'var(--dark-text-primary)',
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


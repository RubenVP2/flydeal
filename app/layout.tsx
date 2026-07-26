import './globals.css';
import type { Metadata, Viewport } from 'next';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'FlyDeal — Analyse quotidienne des prix de vols',
  description: 'Surveillez vos routes, détectez les bonnes affaires et maîtrisez les tactiques de contournement.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans min-h-screen">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('flydeal-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
        <Nav />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}

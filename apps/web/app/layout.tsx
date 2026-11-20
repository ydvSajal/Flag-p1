import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Footer, TopBar } from '@/components/shell';
import { ToastProvider } from '@/components/ui/toast';
import { FlagsProvider } from '@/lib/flags';
import './globals.css';

export const metadata: Metadata = {
  title: 'PickLab: which one wins?',
  description: 'Post options, let real people pick. A live Flagsmith A/B test.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f1e7' },
    { media: '(prefers-color-scheme: dark)', color: '#14120e' },
  ],
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <body>
      <ToastProvider>
        <FlagsProvider>
          <TopBar />
          <main>{children}</main>
          <Footer />
        </FlagsProvider>
      </ToastProvider>
    </body>
  </html>
);

export default RootLayout;

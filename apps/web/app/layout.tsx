import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Footer, TopBar } from '@/components/shell';
import { ToastProvider } from '@/components/ui/toast';
import { FlagsProvider } from '@/lib/flags';
import { InstallSupport } from '@/components/install-support';
import './globals.css';

export const metadata: Metadata = {
  title: 'PickLab · Creator studio',
  icons: { icon: '/studio/picklab-192.png', apple: '/studio/picklab-180.png' },
  appleWebApp: { capable: true, title: 'PickLab', statusBarStyle: 'default' },
  description: 'Post options, let real people pick. A live Flagsmith A/B test.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor: '#faf9f5',
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <body>
      <InstallSupport />
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

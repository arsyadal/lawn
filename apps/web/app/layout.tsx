import type { Metadata, Viewport } from 'next';
import { Fira_Code, Fira_Sans } from 'next/font/google';
import './globals.css';
import { PwaRegister } from '@/components/PwaRegister';

const sans = Fira_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-fira-sans', display: 'swap' });
const mono = Fira_Code({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-fira-code', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Lawn', template: '%s | Lawn' },
  description: 'Operasional laundry sepatu dari penerimaan sampai pengambilan.',
  applicationName: 'Lawn',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Lawn' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#17462c' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

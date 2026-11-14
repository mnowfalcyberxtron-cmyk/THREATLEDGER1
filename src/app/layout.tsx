import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ThreatLedger — Enterprise Cyber Threat Intelligence Operations Platform',
  description: 'Centralized intelligence, evidence, assignments and historical records.',
  icons: {
    icon: '/brand/threatledger-logo.png',
    shortcut: '/brand/threatledger-logo.png',
    apple: '/brand/threatledger-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#060a12] text-slate-100">
        {children}
      </body>
    </html>
  );
}

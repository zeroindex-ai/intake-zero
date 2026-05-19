import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Start a project — ZeroIndex',
  description:
    'Tell me about your project. I&rsquo;ll respond within one business day with whether it&rsquo;s a fit and what the next step looks like.',
  metadataBase: new URL(process.env.PUBLIC_BASE_URL ?? 'https://intake.zeroindex.ai'),
  openGraph: {
    title: 'Start a project — ZeroIndex',
    description: 'Independent AI engineering. Tell me about your project.',
    url: '/',
    siteName: 'ZeroIndex',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* /favicon.ico is auto-served + auto-linked by Next.js from app/favicon.ico */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
        <link rel="apple-touch-icon" href="/favicon-180x180.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}

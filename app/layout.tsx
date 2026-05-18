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
      <body>{children}</body>
    </html>
  );
}

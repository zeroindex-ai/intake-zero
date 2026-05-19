import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Page not found · ZeroIndex' };

export default function NotFound() {
  return (
    <section className="pt-10 pb-24 max-w-4xl">
      <div className="label mb-3">404</div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        Page not found.
      </h1>
      <p className="mt-4 muted text-base leading-relaxed">
        The page you were looking for has moved or never existed. Head to the{' '}
        <Link href="/" className="inline-link">
          intake form
        </Link>{' '}
        to start a project.
      </p>
    </section>
  );
}

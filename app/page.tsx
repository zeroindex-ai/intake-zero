import { IntakeForm } from '@/components/intake-form';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-12 md:py-20">
        <header className="mb-12 md:mb-16">
          <div className="label mb-3">ZeroIndex · Intake</div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[0.98]">
            Tell me about
            <br />
            your project.
          </h1>
          <p className="mt-6 muted text-lg max-w-xl">
            Three required fields. I read every one. Response within one business day with whether
            it&rsquo;s a fit and what the next step looks like &mdash; or a polite redirect if not.
          </p>
        </header>
        <IntakeForm />
      </div>
    </main>
  );
}

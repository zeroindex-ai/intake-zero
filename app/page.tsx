import { IntakeForm } from '@/components/intake-form';

export default function HomePage() {
  return (
    <>
      <section className="pt-10 pb-8">
        <div className="label mb-3">Intake</div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[0.98]">
          Tell me about your project.
        </h1>
        <p className="mt-6 muted text-lg max-w-2xl">
          Three required fields. I read every one. Response within one business day with whether
          it&rsquo;s a fit and what the next step looks like &mdash; or a polite redirect if not.
        </p>
      </section>
      <section className="pb-24">
        <IntakeForm />
      </section>
    </>
  );
}

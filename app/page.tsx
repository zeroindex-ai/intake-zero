import { IntakeForm } from '@/components/intake-form';

export default function HomePage() {
  return (
    <>
      <section className="pt-10 pb-8">
        <div className="label mb-3">Intake</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Tell me about your project.
        </h1>
        <p className="mt-4 muted text-base leading-relaxed max-w-[60rem]">
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

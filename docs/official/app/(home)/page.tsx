import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col justify-center gap-6 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-fd-muted-foreground">
        Motion-first blackboard renderer
      </p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">dreamer-genui</h1>
      <p className="text-lg text-fd-muted-foreground">
        Tutor-authored JSON becomes an animated classroom blackboard: kinetic text, figures that
        draw themselves in, cue-synced motion, themes and assessments.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/docs"
          className="rounded-md bg-fd-primary px-5 py-2.5 font-medium text-fd-primary-foreground"
        >
          Read the docs
        </Link>
        <Link
          href="/docs/figures/charts"
          className="rounded-md border border-fd-border px-5 py-2.5 font-medium"
        >
          Explore figures
        </Link>
      </div>
    </div>
  );
}

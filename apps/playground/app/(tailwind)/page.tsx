import Link from 'next/link';

/**
 * Playground index (v2.2 §5): one route per milestone. Milestones that are
 * shipped link to a live page; future milestones are listed with their status
 * so the human can see the sequence without dead links.
 */
const ROUTES = [
  { href: '/m1', id: 'M1', title: 'Protocol', status: 'done', note: 'fixtures, JSON Schema, error codes' },
  { href: '/m2', id: 'M2', title: 'Core', status: 'done', note: 'reducer, cues, theme, prompt guide, snapshots' },
  { href: '/m3', id: 'M3', title: 'Renderer & kinetic text', status: 'done', note: 'text, marks, cues, moods, styling paths' },
  { href: '/m4', id: 'M4', title: 'Board behaviour & ambience', status: 'done', note: 'attach/return, receding, camera, streaming' },
  { href: '/showreel', id: '§9.4', title: 'Showreel', status: 'done', note: 'eleven-beat motion-graphic gate' },
  { href: '/plain-css', id: 'M3', title: 'Plain-CSS host', status: 'done', note: 'no Tailwind required' },
] as const;

const PLANNED = [
  ['M4b', 'retrofit + layout/camera showcase (v2.2)'],
  ['M5', 'figures, diagrams, hand-drawn annotations'],
  ['M5b', '3D figures (v2.2)'],
  ['M6a/M6b', 'questions, assessment, exam run-through'],
  ['M7', 'plugins, devtools, authoring'],
  ['M8', 'hardening and release (v2.2)'],
] as const;

export default function PlaygroundIndex() {
  return (
    <main className="mx-auto grid max-w-5xl gap-8 p-6 lg:grid-cols-[1fr_280px]">
      <section>
        <h1 className="text-3xl font-semibold">dreamer-genui playground</h1>
        <p className="mt-2 text-neutral-600">
          One route per milestone. Each route shows live demos of its acceptance criteria, a
          checklist, logs and a fixture picker scoped to that milestone.
        </p>

        <ul className="mt-6 grid gap-3">
          {ROUTES.map((route) => (
            <li key={route.href}>
              <Link
                href={route.href}
                className="block rounded-xl border border-neutral-300 p-4 hover:border-neutral-500"
              >
                <span className="text-sm font-semibold text-neutral-500">{route.id}</span>{' '}
                <span className="font-medium">{route.title}</span>{' '}
                <span className="text-sm text-emerald-700">({route.status})</span>
                <span className="mt-1 block text-sm text-neutral-600">{route.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <aside>
        <h2 className="text-lg font-semibold">Planned routes</h2>
        <ul className="mt-2 space-y-2 text-sm text-neutral-600">
          {PLANNED.map(([id, note]) => (
            <li key={id}>
              <code>{id}</code> — {note}
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}

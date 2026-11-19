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
  { href: '/m4b', id: 'M4b', title: 'Layout & camera showcase', status: 'done', note: 'flow/split/grid/stage, slots, RTL, density, tilt/dolly paths' },
  { href: '/m4c', id: 'M4c', title: 'Motion language', status: 'done', note: 'reference scenes, transitions, text morph, pointer, reading pacing' },
  { href: '/m4d', id: 'M4d', title: 'UI kit (shadcn parity)', status: 'done', note: '12 tutor-addressable blocks, host-only kit, themable and tree-shakeable' },
  { href: '/m5', id: 'M5', title: 'Figures & diagrams', status: 'done', note: 'flowcharts, diagrams, timelines, labeled art, charts, alt fallbacks' },
  { href: '/m5b', id: 'M5b', title: '3D figures & model connectors', status: 'done', note: 'model3d, scene3d, static/http/cached connectors, cue tours, parts list' },
  { href: '/showreel', id: '§9.4', title: 'Showreel', status: 'done', note: 'eleven-beat motion-graphic gate' },
  { href: '/plain-css', id: 'M3', title: 'Plain-CSS host', status: 'done', note: 'no Tailwind required' },
  { href: '/app', id: 'app', title: 'Live board app', status: 'ongoing', note: "A live example of the board working in realime"}
] as const;

const PLANNED = [
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
                className="block rounded-xl border hover:rotate-[-4] border-neutral-300 p-4 shadow-sm hover:scale-95 transition-all duration-300 ease-linear hover:border-neutral-500 hover:shadow-md"
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

      <aside >
        <div className="border-2 rounded-md h-content p-3">
          <h2 className="text-lg font-semibold">Planned routes</h2>
        <ul className="mt-2 space-y-2 text-sm text-neutral-600">
          {PLANNED.map(([id, note]) => (
            <li key={id}>
              <code>{id}</code> — {note}
            </li>
          ))}
        </ul>
        </div>

      </aside>
    </main>
  );
}

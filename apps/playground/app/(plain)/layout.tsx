import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './plain-globals.css';

export const metadata: Metadata = {
  title: 'dreamer-genui — plain CSS host',
  description: 'The board rendered with dreamer-genui/styles.css only: no Tailwind, no bridge.',
};

/**
 * A second root layout: this route group deliberately never loads the
 * Tailwind global stylesheet, so the page proves the plain-CSS path.
 */
export default function PlainLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

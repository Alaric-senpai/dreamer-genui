import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'M3 — Renderer · dreamer-genui playground',
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

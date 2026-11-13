import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'M4 — Board behaviour · dreamer-genui playground',
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

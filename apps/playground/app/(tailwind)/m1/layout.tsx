import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'M1 — Protocol · dreamer-genui playground',
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

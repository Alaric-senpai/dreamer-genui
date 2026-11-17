import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'M4b — Layout & camera showcase · dreamer-genui playground',
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

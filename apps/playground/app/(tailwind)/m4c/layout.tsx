import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'M4c — Motion language showcase · dreamer-genui playground',
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

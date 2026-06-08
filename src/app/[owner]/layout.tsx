import type { ReactNode } from 'react';
import { CURATED_REPOS } from '@/lib/curated-repos';

export const dynamicParams = false;

export async function generateStaticParams() {
  const owners = new Set(CURATED_REPOS.map((repo) => repo.owner));

  return Array.from(owners).map((owner) => ({
    owner,
  }));
}

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return children;
}

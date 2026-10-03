'use client';

import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import LoadingScreen from '@/components/LoadingScreen';
import { resolveRepositoryNavigation } from '@/lib/github-url';

const RepositoryApp = dynamic(() => import('@/features/repository/RepositoryApp'), {
  loading: () => <LoadingScreen />,
});

export default function HomeRoute({ landing }: { landing: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const target = resolveRepositoryNavigation(
    pathname,
    searchParams.toString(),
    typeof window === 'undefined' ? '' : window.location.hash
  );

  if (!target) return landing;

  return (
    <RepositoryApp
      key={`${target.owner}/${target.repo}`}
      owner={target.owner}
      repo={target.repo}
      directTarget={target}
    />
  );
}

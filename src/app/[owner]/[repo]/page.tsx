import { Suspense } from 'react';
import RepositoryExplorerClient from './client';
import LoadingScreen from '@/components/LoadingScreen';

// For static export, we need to provide generateStaticParams
// Pre-generate common repository routes for static export
export async function generateStaticParams() {
  return [
    { owner: 'torvalds', repo: 'linux' },
    { owner: 'python', repo: 'cpython' },
    { owner: 'bminor', repo: 'glibc' },
    { owner: 'llvm', repo: 'llvm-project' },
  ];
}

interface PageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

export default async function RepositoryExplorerPage({ params }: PageProps) {
  const { owner, repo } = await params;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <RepositoryExplorerClient owner={owner} repo={repo} />
    </Suspense>
  );
}

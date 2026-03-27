import { Suspense } from 'react';
import RepositoryExplorerClient from './client';
import LoadingScreen from '@/components/LoadingScreen';
import { getAllGuideDocuments } from '@/lib/guides/docs-loader';

// Only pre-generated routes are valid; all others return 404
export const dynamicParams = false;

// Generate routes for all curated repositories from docs/ guides
export async function generateStaticParams() {
  const guides = getAllGuideDocuments();
  return Array.from(guides.values()).map((doc) => ({
    owner: doc.metadata.owner,
    repo: doc.metadata.repo,
  }));
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

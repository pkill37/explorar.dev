import { Suspense } from 'react';
import type { Metadata } from 'next';
import RepositoryExplorerClient from './client';
import LoadingScreen from '@/components/LoadingScreen';
import { CURATED_REPOS } from '@/lib/curated-repos';
import { getAllCuratedGuideDocuments } from '@/lib/guides/docs-loader';

// Only curated, pre-generated routes are valid.
export const dynamicParams = false;

// Generate repository routes from the parent owner segment.
export async function generateStaticParams({ params }: { params: { owner: string } }) {
  const { owner } = params;

  return CURATED_REPOS.filter((repo) => repo.owner === owner).map((repo) => ({
    repo: repo.repo,
  }));
}

interface PageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { owner, repo } = await params;
  const guides = getAllCuratedGuideDocuments();
  const guide = Array.from(guides.values()).find(
    (d) => d.metadata.owner === owner && d.metadata.repo === repo
  );
  const title = guide ? guide.metadata.name : `${owner}/${repo}`;
  const description = guide
    ? guide.metadata.description
    : `Explore the ${owner}/${repo} source code with an interactive code browser.`;
  return { title, description };
}

export default async function RepositoryExplorerPage({ params }: PageProps) {
  const { owner, repo } = await params;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <RepositoryExplorerClient owner={owner} repo={repo} />
    </Suspense>
  );
}

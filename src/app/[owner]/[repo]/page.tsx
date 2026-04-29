import { Suspense } from 'react';
import type { Metadata } from 'next';
import RepositoryExplorerClient from './client';
import LoadingScreen from '@/components/LoadingScreen';
import { getAllCuratedGuideDocuments } from '@/lib/guides/docs-loader';

// Only curated, pre-generated routes are valid.
export const dynamicParams = false;

// Generate routes only for curated repositories that ship a bundled guide.
export async function generateStaticParams() {
  const guides = getAllCuratedGuideDocuments();
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

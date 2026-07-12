import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import RepositoryExplorerClient from '@/features/repository/RepositoryExplorerClient';
import LoadingScreen from '@/components/LoadingScreen';
import { getCuratedRepoRouteParams, resolveCuratedRepoRoute } from '@/lib/curated-repos';
import { getAllCuratedGuideDocuments } from '@/features/guides/docs-loader';

export const dynamicParams = false;

export async function generateStaticParams() {
  return getCuratedRepoRouteParams();
}

interface PageProps {
  params: Promise<{
    repoPath: string[];
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { repoPath } = await params;
  const resolved = resolveCuratedRepoRoute(repoPath);

  if (!resolved) {
    return {};
  }

  const { config, isLegacyPath } = resolved;
  const guides = getAllCuratedGuideDocuments();
  const guide = Array.from(guides.values()).find(
    (d) => d.metadata.owner === config.owner && d.metadata.repo === config.repo
  );
  const title = guide ? guide.metadata.name : config.displayName;
  const description = guide
    ? guide.metadata.description
    : `Explore the ${config.displayName} source code with an interactive code browser.`;

  return isLegacyPath
    ? {
        title: `${config.displayName} | explorar.dev`,
        description: `Legacy route for ${config.displayName}. Redirecting to the canonical explorar.dev URL.`,
      }
    : { title, description };
}

export default async function RepositoryRoutePage({ params }: PageProps) {
  const { repoPath } = await params;
  const resolved = resolveCuratedRepoRoute(repoPath);

  if (!resolved) {
    notFound();
  }

  if (resolved.isLegacyPath) {
    permanentRedirect(resolved.canonicalPath);
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <RepositoryExplorerClient owner={resolved.config.owner} repo={resolved.config.repo} />
    </Suspense>
  );
}

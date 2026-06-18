import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import RepositoryExplorerClient from '../[owner]/[repo]/client';
import LoadingScreen from '@/components/LoadingScreen';
import {
  CURATED_REPOS,
  getCuratedRepo,
  getCuratedRepoBySlug,
  getCuratedRepoPath,
} from '@/lib/curated-repos';
import { getAllCuratedGuideDocuments } from '@/lib/guides/docs-loader';

export const dynamicParams = false;

export async function generateStaticParams() {
  return CURATED_REPOS.flatMap((repo) => [
    { repoPath: [repo.slug] },
    { repoPath: [repo.owner, repo.repo] },
  ]);
}

interface PageProps {
  params: Promise<{
    repoPath: string[];
  }>;
}

function resolveRepoRoute(pathSegments: string[]) {
  if (pathSegments.length === 1) {
    const config = getCuratedRepoBySlug(pathSegments[0]);
    if (!config) {
      return null;
    }

    return {
      config,
      canonicalPath: `/${config.slug}`,
      isLegacyPath: false,
    };
  }

  if (pathSegments.length === 2) {
    const [owner, repo] = pathSegments;
    const config = getCuratedRepo(owner, repo);
    if (!config) {
      return null;
    }

    return {
      config,
      canonicalPath: getCuratedRepoPath(owner, repo),
      isLegacyPath: true,
    };
  }

  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { repoPath } = await params;
  const resolved = resolveRepoRoute(repoPath);

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
  const resolved = resolveRepoRoute(repoPath);

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

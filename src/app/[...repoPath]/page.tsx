import { Suspense } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import RepositoryExplorerClient from '@/features/repository/RepositoryExplorerClient';
import LoadingScreen from '@/components/LoadingScreen';
import { getCuratedRepoRouteParams, resolveCuratedRepoRoute } from '@/lib/curated-repos';
import { getCuratedGuideByRepo } from '@/features/guides/docs-loader';
import { parseGitHubUrl } from '@/lib/github-url';

// Arbitrary repositories are served by the static app-shell fallback. Keeping
// this false lets Next's static export remain valid for the curated paths.
export const dynamicParams = false;

export async function generateStaticParams() {
  return getCuratedRepoRouteParams();
}

interface PageProps {
  params: Promise<{
    repoPath: string[];
  }>;
}

export default async function RepositoryRoutePage({ params }: PageProps) {
  const { repoPath } = await params;
  const resolved = resolveCuratedRepoRoute(repoPath);

  if (!resolved && repoPath.length < 2) notFound();

  if (!resolved) {
    const directTarget = parseGitHubUrl(`https://github.com/${repoPath.join('/')}`);
    if (!directTarget) notFound();
    return (
      <Suspense
        fallback={
          <LoadingScreen
            title={`${directTarget.owner}/${directTarget.repo} source explorer`}
            description="Loading the requested public GitHub repository."
          />
        }
      >
        <RepositoryExplorerClient
          owner={directTarget.owner}
          repo={directTarget.repo}
          directTarget={directTarget}
          loadingTitle={`${directTarget.owner}/${directTarget.repo} source explorer`}
          loadingDescription="Loading the requested public GitHub repository."
        />
      </Suspense>
    );
  }

  if (resolved.isLegacyPath) {
    permanentRedirect(resolved.canonicalPath);
  }

  const guide = getCuratedGuideByRepo(resolved.config.owner, resolved.config.repo);

  return (
    <Suspense
      fallback={
        <LoadingScreen
          title={`${resolved.config.displayName} source explorer`}
          description={resolved.config.seoDescription}
        />
      }
    >
      <RepositoryExplorerClient
        owner={resolved.config.owner}
        repo={resolved.config.repo}
        guideContent={guide?.content}
        guideDefaultOpenIds={guide?.metadata.defaultOpenIds}
        loadingTitle={`${resolved.config.displayName} source explorer`}
        loadingDescription={resolved.config.seoDescription}
      />
    </Suspense>
  );
}

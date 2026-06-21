'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTrustedVersion } from '@/lib/github-api';
import { getStorageUsage, RepositoryMetadata } from '@/lib/repo-storage';
import { useRepository } from '@/contexts/RepositoryContext';
import { CURATED_REPOS, getCuratedRepoPath, type CuratedRepoConfig } from '@/lib/curated-repos';

const HERO_SLOGANS = [
  'Shorten time-to-context on large codebases.',
  'Pedagogical exploration, not just raw browsing.',
  'Grounded in LSP and MCP, not black-box explanation.',
];

const COMMUNITY_BADGES = [
  {
    href: 'https://github.com/pkill37/explorar.dev',
    ariaLabel: 'GitHub repository stars badge',
    src: 'https://img.shields.io/github/stars/pkill37/explorar.dev',
    alt: 'GitHub Repo stars',
  },
  {
    href: 'https://discord.gg/fuXYz44tSs',
    ariaLabel: 'Join the Explorar.dev Discord server',
    src: 'https://dcbadge.limes.pink/api/server/fuXYz44tSs',
    alt: 'Discord server badge',
  },
  {
    href: 'https://news.ycombinator.com/item?id=46066280',
    ariaLabel: 'Featured on Hacker News story',
    src: 'https://hackerbadge.now.sh/api?id=46066280',
    alt: 'Featured on Hacker News',
  },
] as const;

function formatDisplayRef(ref: string): string {
  if (!/^[0-9a-f]{7,40}$/i.test(ref)) {
    return ref;
  }

  return ref.length > 12 ? `${ref.slice(0, 12)}…` : ref;
}

function CommunityPanel() {
  return (
    <div className="w-full max-w-md">
      <div className="mt-4 flex flex-col gap-2">
        {COMMUNITY_BADGES.map((badge) => (
          <a
            key={badge.href}
            href={badge.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-fit max-w-full"
            aria-label={badge.ariaLabel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badge.src}
              alt={badge.alt}
              className="block h-7 w-auto max-w-full rounded-sm opacity-90 transition-opacity hover:opacity-100"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { setRepository } = useRepository();
  const [repositories, setRepositories] = useState<RepositoryMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load existing repositories
  const loadData = async () => {
    try {
      const usage = await getStorageUsage();
      // Only show GitHub repositories (filter out uploaded ones)
      setRepositories(usage.repositories.filter((r) => r.source === 'github'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Get selected branch for a repo (defaults to first trusted branch)
  const getSelectedBranch = (repo: CuratedRepoConfig): string => {
    return getTrustedVersion(repo.owner, repo.repo);
  };

  // Handle repository download or open
  const handleRepositoryAction = async (githubRepo: CuratedRepoConfig) => {
    const identifier = `${githubRepo.owner}~${githubRepo.repo}`;
    const existingRepo = repositories.find(
      (r) => r.source === 'github' && r.identifier === identifier
    );

    // If already downloaded, just open it
    if (existingRepo) {
      try {
        await setRepository('github', identifier, githubRepo.displayName);
        router.push(getCuratedRepoPath(githubRepo.owner, githubRepo.repo));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open repository');
      }
      return;
    }

    setError(null);
    try {
      const selectedBranch = getSelectedBranch(githubRepo);
      if (!selectedBranch) {
        throw new Error('No branch selected');
      }

      await setRepository('github', identifier, githubRepo.displayName);
      router.push(getCuratedRepoPath(githubRepo.owner, githubRepo.repo));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open repository');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-gray-100 relative code-background">
      {/* Circuit board traces animation */}
      <div className="circuit-traces">
        <div className="circuit-trace"></div>
        <div className="circuit-trace"></div>
        <div className="circuit-trace"></div>
        <div className="circuit-trace"></div>
        <div className="circuit-trace"></div>
        <div className="circuit-trace"></div>
        <div className="circuit-trace"></div>
        <div className="circuit-trace"></div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-12 pb-4 sm:pt-16 sm:pb-6 relative z-10">
        <div className="w-full max-w-6xl mx-auto">
          {/* Header */}
          <header className="mb-14">
            <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <div className="text-center lg:text-left">
                <h1 className="mb-6 text-4xl font-semibold tracking-tight text-gray-100 sm:text-5xl">
                  explorar.dev
                </h1>
                <div className="mx-auto max-w-3xl space-y-3 lg:mx-0">
                  {HERO_SLOGANS.map((slogan) => (
                    <p key={slogan} className="text-base leading-relaxed text-gray-300 sm:text-lg">
                      {slogan}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex justify-center lg:justify-end">
                <CommunityPanel />
              </div>
            </div>
          </header>

          {/* Error Display */}
          {error && (
            <div className="mb-8 p-4 bg-red-900/20 border-l-4 border-red-400 rounded-lg shadow-sm animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-red-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="text-sm text-red-200">{error}</div>
              </div>
            </div>
          )}

          {/* Repo grid */}
          <div className="mb-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CURATED_REPOS.map((repo) => {
              const selectedBranch = getSelectedBranch(repo);
              const selectedBranchLabel = selectedBranch ? formatDisplayRef(selectedBranch) : '';
              const avatarUrl = `/avatars/${repo.avatarFile ?? `${repo.owner}.png`}`;

              return (
                <button
                  key={`${repo.owner}/${repo.repo}`}
                  onClick={() => !repo.dimmed && handleRepositoryAction(repo)}
                  disabled={repo.dimmed}
                  className={`group relative p-5 bg-gray-900/60 border border-gray-800 rounded-xl transition-all duration-200 text-left overflow-hidden ${repo.dimmed ? 'opacity-25 grayscale cursor-default' : 'hover:bg-gray-800/70 hover:border-gray-700 cursor-pointer'}`}
                >
                  <div className="flex gap-4">
                    {/* Avatar */}
                    <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt={repo.owner}
                          className="w-full h-full object-contain p-1.5"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          {repo.icon || '📦'}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h2 className="text-sm font-semibold text-gray-100 group-hover:text-white transition-colors truncate">
                          {repo.displayName}
                        </h2>
                      </div>
                      <p className="text-[11px] font-mono text-gray-500 truncate mb-1.5">
                        {repo.owner}/{repo.repo}
                      </p>
                      {repo.description && (
                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                          {repo.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer row */}
                  <div className="mt-3 flex items-center justify-between">
                    {selectedBranch && !repo.dimmed && (
                      <div
                        className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-[10px] font-mono rounded border border-gray-700/60"
                        title={selectedBranch}
                      >
                        {selectedBranchLabel}
                      </div>
                    )}
                    <div className="text-[11px] text-gray-600 group-hover:text-gray-400 transition-colors ml-auto">
                      Explore →
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

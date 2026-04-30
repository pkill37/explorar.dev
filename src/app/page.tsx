'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTrustedVersion } from '@/lib/github-api';
import { getStorageUsage, RepositoryMetadata } from '@/lib/repo-storage';
import { downloadBranch, DownloadProgress } from '@/lib/github-archive';
import { useRepository } from '@/contexts/RepositoryContext';
import { CURATED_REPOS, type CuratedRepoConfig } from '@/lib/curated-repos';

// Icon Components
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const GitHubIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

// Social Links Data
const SOCIAL_LINKS = [
  {
    name: 'GitHub',
    url: 'https://github.com/pkill37/explorar.dev',
    icon: GitHubIcon,
    color: 'hover:bg-gray-900 hover:text-white',
    title: 'Contribute & Build Together',
    description: 'Fork, star, and help improve the codebase',
  },
  {
    name: 'Discord',
    url: 'https://discord.gg/fuXYz44tSs',
    icon: DiscordIcon,
    color: 'hover:bg-[#5865F2] hover:text-white',
    title: 'Join Our Community',
    description: 'Discuss code, share discoveries, get help',
  },
];

export default function Home() {
  const router = useRouter();
  const { setRepository } = useRepository();
  const [repositories, setRepositories] = useState<RepositoryMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadingRepo, setDownloadingRepo] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

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
    const repoKey = `${githubRepo.owner}/${githubRepo.repo}`;
    const identifier = `${githubRepo.owner}~${githubRepo.repo}`;
    const existingRepo = repositories.find(
      (r) => r.source === 'github' && r.identifier === identifier
    );

    // If already downloaded, just open it
    if (existingRepo) {
      try {
        await setRepository('github', identifier, githubRepo.displayName);
        router.push(`/${githubRepo.owner}/${githubRepo.repo}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open repository');
      }
      return;
    }

    // Otherwise, download it
    setDownloadingRepo(repoKey);
    setError(null);

    try {
      const selectedBranch = getSelectedBranch(githubRepo);
      if (!selectedBranch) {
        throw new Error('No branch selected');
      }

      await downloadBranch(githubRepo.owner, githubRepo.repo, selectedBranch, setDownloadProgress);

      await loadData();

      await setRepository('github', identifier, githubRepo.displayName);
      router.push(`/${githubRepo.owner}/${githubRepo.repo}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingRepo(null);
      setDownloadProgress(null);
    }
  };

  // Show progress overlay if downloading
  if (downloadProgress) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100">
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-md mx-auto">
            <div className="p-8 bg-gradient-to-br from-gray-800/80 to-gray-800/60 border border-gray-700/50 rounded-2xl shadow-xl backdrop-blur-sm">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-gray-700/50 animate-pulse">
                  <svg
                    className="w-8 h-8 text-gray-300 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-100">Downloading Repository</h2>
                <p className="text-sm text-gray-400 mb-6">
                  {downloadProgress.message || 'Preparing...'}
                </p>
                <div className="w-full bg-gray-700/50 rounded-full h-3 mb-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
                    style={{ width: `${downloadProgress.progress || 0}%` }}
                  />
                </div>
                <div className="space-y-2">
                  {downloadProgress.phase === 'downloading' &&
                    downloadProgress.bytesDownloaded &&
                    downloadProgress.totalBytes && (
                      <div className="text-sm text-gray-300 font-medium">
                        {Math.round((downloadProgress.bytesDownloaded / 1024 / 1024) * 10) / 10} MB
                        / {Math.round((downloadProgress.totalBytes / 1024 / 1024) * 10) / 10} MB
                      </div>
                    )}
                  {downloadProgress.phase === 'storing' &&
                    downloadProgress.filesProcessed &&
                    downloadProgress.totalFiles && (
                      <div className="text-sm text-gray-300 font-medium">
                        Processing {downloadProgress.filesProcessed} / {downloadProgress.totalFiles}{' '}
                        files
                      </div>
                    )}
                  <div className="text-xs text-gray-500">
                    {Math.round(downloadProgress.progress || 0)}% complete
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
          <header className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">
              explorar.dev
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Explore curated open-source repositories with an interactive code browser. Study
              real-world codebases and learn from the best.
            </p>
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
              const isDownloading = downloadingRepo === `${repo.owner}/${repo.repo}`;
              const selectedBranch = getSelectedBranch(repo);
              const avatarUrl = `/avatars/${repo.avatarFile ?? `${repo.owner}.png`}`;

              return (
                <button
                  key={`${repo.owner}/${repo.repo}`}
                  onClick={() => !repo.dimmed && handleRepositoryAction(repo)}
                  disabled={isDownloading || repo.dimmed}
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
                      <div className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-[10px] font-mono rounded border border-gray-700/60">
                        {selectedBranch}
                      </div>
                    )}
                    {isDownloading ? (
                      <div className="flex items-center gap-1.5 text-xs text-blue-400 ml-auto">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Downloading…
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-600 group-hover:text-gray-400 transition-colors ml-auto">
                        Explore →
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 px-4 border-t border-gray-800/50 relative z-10">
        <div className="w-full max-w-6xl mx-auto">
          <h3 className="text-sm font-medium text-gray-500 mb-4 text-center">Join Our Community</h3>
          <div className="flex flex-col gap-3 max-w-lg mx-auto w-full">
            {SOCIAL_LINKS.map((link, index) => {
              const IconComponent = link.icon;
              const isGitHub = link.name === 'GitHub';
              return isGitHub ? (
                <div
                  key={index}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-green-500/30 bg-gradient-to-r from-green-500/10 to-blue-500/10 text-gray-400 transition-all duration-300 hover:border-gray-600 hover:shadow-lg hover:shadow-gray-900/50 hover:text-gray-200`}
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 flex-1 min-w-0"
                    aria-label={link.title}
                  >
                    <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 transition-transform group-hover:scale-110" />
                    <div className="flex flex-col text-left flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-300 group-hover:text-white mb-0.5">
                        {link.title}
                      </span>
                      <span className="text-xs text-gray-500 group-hover:text-gray-400 leading-tight">
                        {link.description}
                      </span>
                    </div>
                  </a>
                  <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                    <div className="px-2 py-1 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-md">
                      <span className="text-xs font-medium text-green-300">⭐ Star</span>
                    </div>
                    <div className="px-2 py-1 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-md">
                      <span className="text-xs font-medium text-orange-300">🍴 Fork</span>
                    </div>
                    <a
                      href="https://github.com/pkill37/explorar.dev/issues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-gradient-to-r from-gray-500/10 to-gray-500/5 border border-gray-500/20 rounded-md hover:border-gray-400/40 transition-colors"
                      aria-label="Report an issue"
                    >
                      <span className="text-xs font-medium text-gray-300">🐛 Issue</span>
                    </a>
                    <a
                      href="https://github.com/pkill37/explorar.dev/pulls"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-gradient-to-r from-gray-500/10 to-gray-500/5 border border-gray-500/20 rounded-md hover:border-gray-400/40 transition-colors"
                      aria-label="Submit a PR"
                    >
                      <span className="text-xs font-medium text-gray-300">📝 PR</span>
                    </a>
                  </div>
                </div>
              ) : (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 text-gray-400 transition-all duration-300 hover:border-gray-600 hover:shadow-lg hover:shadow-gray-900/50 hover:text-gray-200 ${link.color}`}
                  title={link.title}
                  aria-label={link.title}
                >
                  <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 transition-transform group-hover:scale-110" />
                  <div className="flex flex-col text-left flex-1">
                    <span className="text-sm font-semibold text-gray-300 group-hover:text-white mb-0.5">
                      {link.title}
                    </span>
                    <span className="text-xs text-gray-500 group-hover:text-gray-400 leading-tight">
                      {link.description}
                    </span>
                  </div>
                  <div className="ml-auto">
                    <div className="px-2 py-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-md">
                      <span className="text-xs font-medium text-blue-300">Join</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </footer>
    </div>
  );
}

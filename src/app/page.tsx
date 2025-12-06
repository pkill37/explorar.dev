'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getTrustedVersions } from '@/lib/github-api';
import { getStorageUsage, RepositoryMetadata } from '@/lib/repo-storage';
import { downloadBranch, DownloadProgress } from '@/lib/github-archive';
import { useRepository } from '@/contexts/RepositoryContext';

// Icon Components
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

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

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
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
  },
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/in/f%C3%A1bio-maia-a037b7227/',
    icon: LinkedInIcon,
    color: 'hover:bg-[#0077b5] hover:text-white',
  },
  {
    name: 'Discord',
    url: 'https://discord.gg/fuXYz44tSs',
    icon: DiscordIcon,
    color: 'hover:bg-[#5865F2] hover:text-white',
  },
  {
    name: 'Telegram',
    url: 'https://t.me/explorardev',
    icon: TelegramIcon,
    color: 'hover:bg-[#0088cc] hover:text-white',
  },
];

interface GitHubRepo {
  owner: string;
  repo: string;
  displayName: string;
  trustedBranches: string[];
  description?: string;
  icon?: string;
  gradient?: string;
}

// Curated quickstart repositories
const QUICKSTART_REPOS: GitHubRepo[] = [
  {
    owner: 'torvalds',
    repo: 'linux',
    displayName: 'Linux Kernel',
    icon: '🐧',
    gradient: 'from-orange-500/10 to-red-500/10',
    description:
      'Explore the Linux kernel source code. Study kernel architecture, system calls, device drivers, and core subsystems.',
    trustedBranches: getTrustedVersions('torvalds', 'linux'),
  },
  {
    owner: 'llvm',
    repo: 'llvm-project',
    displayName: 'LLVM Project',
    icon: '⚙️',
    gradient: 'from-blue-500/10 to-cyan-500/10',
    description:
      'Explore the LLVM compiler infrastructure. Study compiler design, optimization passes, and code generation.',
    trustedBranches: getTrustedVersions('llvm', 'llvm-project'),
  },
  {
    owner: 'python',
    repo: 'cpython',
    displayName: 'CPython',
    icon: '🐍',
    gradient: 'from-yellow-500/10 to-blue-500/10',
    description:
      'Explore the Python interpreter source code. Learn how Python works under the hood, from bytecode execution to garbage collection.',
    trustedBranches: getTrustedVersions('python', 'cpython'),
  },
  {
    owner: 'bminor',
    repo: 'glibc',
    displayName: 'GNU C Library',
    icon: '📚',
    gradient: 'from-purple-500/10 to-pink-500/10',
    description:
      'Explore the GNU C Library source code. Study standard C library implementations, system calls, and POSIX compliance.',
    trustedBranches: getTrustedVersions('bminor', 'glibc'),
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
  const getSelectedBranch = (repo: GitHubRepo): string => {
    return repo.trustedBranches[0] || '';
  };

  // Handle repository download or open
  const handleRepositoryAction = async (githubRepo: GitHubRepo) => {
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

      {/* Social Links - Top Left Corner */}
      <div className="fixed top-3 left-3 sm:top-4 sm:left-4 z-50 flex items-center gap-1.5 sm:gap-2">
        {SOCIAL_LINKS.map((link, index) => {
          const IconComponent = link.icon;
          return (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 text-gray-400 transition-all duration-300 hover:border-gray-600 hover:shadow-md hover:scale-110 hover:text-gray-200 ${link.color}`}
              title={link.name}
              aria-label={link.name}
            >
              <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
            </a>
          );
        })}
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

          {/* Repository Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {QUICKSTART_REPOS.map((repo) => {
              const isDownloading = downloadingRepo === `${repo.owner}/${repo.repo}`;

              return (
                <button
                  key={`${repo.owner}/${repo.repo}`}
                  onClick={() => handleRepositoryAction(repo)}
                  disabled={isDownloading}
                  className="group relative p-4 bg-gradient-to-br from-gray-800/50 to-gray-800/30 border border-gray-700/50 rounded-xl hover:border-gray-600 hover:shadow-lg hover:shadow-gray-900/50 transition-all duration-300 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none overflow-hidden w-full"
                >
                  {/* Background gradient overlay */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${repo.gradient || 'from-blue-500/10 to-purple-500/10'} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="text-2xl flex-shrink-0">{repo.icon || '📦'}</div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <p className="text-sm font-bold group-hover:text-gray-100 transition-colors font-mono text-gray-200">
                            {repo.owner}/{repo.repo}
                          </p>
                          {repo.trustedBranches.length > 0 && (
                            <div className="px-2 py-0.5 bg-gray-700/50 text-gray-300 text-xs font-medium rounded border border-gray-600/50 flex-shrink-0">
                              {getSelectedBranch(repo)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {repo.description && (
                      <p className="text-xs text-gray-400 mb-3 leading-snug line-clamp-2">
                        {repo.description}
                      </p>
                    )}

                    {isDownloading && (
                      <div className="flex items-center justify-end gap-1.5 pt-3">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 rounded-lg text-xs font-medium text-gray-300 flex-shrink-0">
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
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
                          <span className="hidden sm:inline">Downloading...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Coming Soon: Arbitrary Git Repository */}
          <div className="mt-6 flex justify-center">
            <div className="w-full max-w-md">
              <div className="group relative p-4 bg-gradient-to-br from-gray-800/30 to-gray-800/20 border border-gray-700/30 rounded-xl opacity-60 cursor-not-allowed overflow-hidden">
                {/* Background gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-700/20 to-gray-700/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="text-2xl flex-shrink-0">🔗</div>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <p className="text-sm font-bold transition-colors font-mono text-gray-300">
                          arbitrary git repository
                        </p>
                        <div className="px-2 py-0.5 bg-gray-700/30 text-gray-500 text-xs font-medium rounded border border-gray-600/30 flex-shrink-0">
                          coming soon
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mb-3 leading-snug">
                    Explore any public GitHub repository by entering its URL.
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="https://github.com/owner/repo"
                      disabled
                      className="flex-1 px-3 py-2 text-sm bg-gray-800/30 border border-gray-700/30 rounded-lg text-gray-500 placeholder:text-gray-600 font-mono disabled:cursor-not-allowed"
                    />
                    <button
                      disabled
                      className="px-4 py-2 text-sm font-medium bg-gray-700/30 text-gray-500 rounded-lg disabled:cursor-not-allowed flex-shrink-0"
                    >
                      Explore
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer with Badges */}
      <footer className="w-full py-4 px-4 border-t border-gray-800/50 relative z-10">
        <div className="w-full max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a
              href="https://startupfa.me/s/explorardev?utm_source=explorar.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-80"
            >
              <Image
                src="https://startupfa.me/badges/featured/dark.webp"
                alt="Explorar.dev - Featured on Startup Fame"
                width={171}
                height={54}
                className="h-auto"
                unoptimized
              />
            </a>
            <a
              href="https://dofollow.tools"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-80"
            >
              <Image
                src="https://dofollow.tools/badge/badge_dark.svg"
                alt="Featured on Dofollow.Tools"
                width={200}
                height={54}
                className="h-auto"
                unoptimized
              />
            </a>
            <a
              href="https://twelve.tools"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-80"
            >
              <Image
                src="https://twelve.tools/badge3-dark.svg"
                alt="Featured on Twelve Tools"
                width={200}
                height={54}
                className="h-auto"
                unoptimized
              />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

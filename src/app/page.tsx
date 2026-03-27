'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTrustedVersion } from '@/lib/github-api';
import { getStorageUsage, RepositoryMetadata } from '@/lib/repo-storage';
import { downloadBranch, DownloadProgress } from '@/lib/github-archive';
import { useRepository } from '@/contexts/RepositoryContext';
import { getMultipleRepoMetadata, type RepoMetadata } from '@/lib/repo-metadata';

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
  {
    name: 'Telegram',
    url: 'https://t.me/explorardev',
    icon: TelegramIcon,
    color: 'hover:bg-[#0088cc] hover:text-white',
    title: 'Stay Updated',
    description: 'Get news, updates & quick discussions',
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
  category?: string;
}

interface Category {
  name: string;
  icon: string;
  gradient: string;
  description: string;
}

// Repository categories
const CATEGORIES: Category[] = [
  {
    name: 'System & Kernel',
    icon: '🖥️',
    gradient: 'from-orange-500/20 to-red-500/20',
    description: 'Operating systems and kernel implementations',
  },
  {
    name: 'Compilers & Toolchains',
    icon: '⚙️',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    description: 'Compiler toolchains and build systems',
  },
  {
    name: 'Languages',
    icon: '🐍',
    gradient: 'from-yellow-500/20 to-green-500/20',
    description: 'Programming language implementations',
  },
  {
    name: 'Libraries & Frameworks',
    icon: '📚',
    gradient: 'from-purple-500/20 to-pink-500/20',
    description: 'Core libraries and framework codebases',
  },
];

// Curated quickstart repositories
const QUICKSTART_REPOS: GitHubRepo[] = [
  {
    owner: 'torvalds',
    repo: 'linux',
    displayName: 'Linux Kernel',
    icon: '🐧',
    gradient: 'from-orange-500/10 to-red-500/10',
    category: 'System & Kernel',
    description:
      'Explore the Linux kernel source code. Study kernel architecture, system calls, device drivers, and core subsystems.',
    trustedBranches: (() => {
      const v = getTrustedVersion('torvalds', 'linux');
      return v ? [v] : [];
    })(),
  },
  {
    owner: 'llvm',
    repo: 'llvm-project',
    displayName: 'LLVM Project',
    icon: '⚙️',
    gradient: 'from-blue-500/10 to-cyan-500/10',
    category: 'Compilers & Toolchains',
    description:
      'Explore the LLVM compiler infrastructure. Study compiler design, optimization passes, and code generation.',
    trustedBranches: (() => {
      const v = getTrustedVersion('llvm', 'llvm-project');
      return v ? [v] : [];
    })(),
  },
  {
    owner: 'python',
    repo: 'cpython',
    displayName: 'CPython',
    icon: '🐍',
    gradient: 'from-yellow-500/10 to-blue-500/10',
    category: 'Languages',
    description:
      'Explore the Python interpreter source code. Learn how Python works under the hood, from bytecode execution to garbage collection.',
    trustedBranches: (() => {
      const v = getTrustedVersion('python', 'cpython');
      return v ? [v] : [];
    })(),
  },
  {
    owner: 'bminor',
    repo: 'glibc',
    displayName: 'GNU C Library',
    icon: '🖥️',
    gradient: 'from-orange-500/10 to-red-500/10',
    category: 'System & Kernel',
    description:
      'Explore the GNU C Library source code. Study standard C library implementations, system calls, and POSIX compliance.',
    trustedBranches: (() => {
      const v = getTrustedVersion('bminor', 'glibc');
      return v ? [v] : [];
    })(),
  },
];

export default function Home() {
  const router = useRouter();
  const { setRepository } = useRepository();
  const [repositories, setRepositories] = useState<RepositoryMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadingRepo, setDownloadingRepo] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [repoMetadata, setRepoMetadata] = useState<Map<string, RepoMetadata | null>>(new Map());

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

  // Fetch repository metadata (owner avatars) for quickstart repos
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const reposToFetch = QUICKSTART_REPOS.map((repo) => ({
          owner: repo.owner,
          repo: repo.repo,
        }));

        const metadata = await getMultipleRepoMetadata(reposToFetch);
        setRepoMetadata(metadata);
      } catch (err) {
        console.error('Failed to fetch repository metadata:', err);
        // Don't set error state - this is non-critical, UI will fall back to emojis
      }
    };

    fetchMetadata();
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

          {/* Repository Sea - Whiteboard-style exploration */}
          <div className="mb-16 relative">
            {/* Subtle grid background for whiteboard feel */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            ></div>

            {/* Free-flowing repository cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-auto">
              {QUICKSTART_REPOS.map((repo, index) => {
                const isDownloading = downloadingRepo === `${repo.owner}/${repo.repo}`;
                const category = CATEGORIES.find((c) => c.name === repo.category);

                // Create visual variety with different card heights
                const isLarge = index % 5 === 0;

                // Deterministic rotation based on index (fixes hydration)
                const rotations = [0.15, -0.2, 0.1, -0.15, 0.05, -0.1, 0.2, -0.05];
                const rotation = rotations[index % rotations.length];

                return (
                  <button
                    key={`${repo.owner}/${repo.repo}`}
                    onClick={() => handleRepositoryAction(repo)}
                    disabled={isDownloading}
                    className={`group relative p-5 bg-gradient-to-br from-gray-800/80 to-gray-800/60 border border-gray-700/70 rounded-2xl hover:border-gray-600 hover:shadow-2xl hover:shadow-gray-900/70 hover:-translate-y-1 transition-all duration-300 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0 overflow-hidden ${isLarge ? 'sm:col-span-2' : ''}`}
                    style={{
                      transform: `rotate(${rotation}deg)`,
                    }}
                  >
                    {/* Floating gradient orbs for depth */}
                    <div
                      className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${repo.gradient || 'from-blue-500/30 to-purple-500/30'} blur-3xl opacity-20 group-hover:opacity-100 transition-opacity duration-500`}
                    />
                    <div
                      className={`absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-gradient-to-br ${category?.gradient || 'from-gray-500/30 to-gray-600/30'} blur-3xl opacity-40 group-hover:opacity-70 transition-opacity duration-500`}
                    />

                    <div className="relative z-10">
                      {/* Category badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 px-2.5 py-1 bg-gray-900/70 backdrop-blur-sm border border-gray-700/70 rounded-lg">
                          <span className="text-xs font-medium text-gray-300">
                            {category?.name}
                          </span>
                        </div>
                        {repo.trustedBranches.length > 0 && (
                          <div className="px-2 py-1 bg-gray-700/70 text-gray-200 text-xs font-medium rounded border border-gray-600/70">
                            {getSelectedBranch(repo)}
                          </div>
                        )}
                      </div>

                      {/* Repository identity */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative w-16 h-16 flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                          {(() => {
                            const metadata = repoMetadata.get(`${repo.owner}/${repo.repo}`);
                            const avatarUrl = metadata?.ownerAvatarUrl;

                            if (avatarUrl) {
                              return (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={avatarUrl}
                                  alt={repo.owner}
                                  className="w-full h-full rounded-full object-cover"
                                  onError={(e) => {
                                    // Hide image and show emoji fallback on error
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              );
                            }

                            // Fallback: show emoji if no metadata available yet or fetch failed
                            return (
                              <div className="w-full h-full flex items-center justify-center text-4xl">
                                {repo.icon || '📦'}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-gray-100 group-hover:text-white transition-colors mb-1 truncate">
                            {repo.displayName}
                          </h3>
                          <p className="text-xs font-mono text-gray-400 group-hover:text-gray-300 transition-colors truncate">
                            {repo.owner}/{repo.repo}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      {repo.description && (
                        <p
                          className={`text-sm text-gray-400 leading-relaxed ${isLarge ? 'line-clamp-3' : 'line-clamp-2'} mb-4`}
                        >
                          {repo.description}
                        </p>
                      )}

                      {/* Connection lines decoration for whiteboard feel */}
                      <div className="absolute top-0 right-0 w-16 h-16 opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none">
                        <svg
                          className="w-full h-full"
                          viewBox="0 0 100 100"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path
                            d="M 0 50 Q 25 25, 50 50 T 100 50"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                          />
                        </svg>
                      </div>

                      {/* Status indicators */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-700/30">
                        {isDownloading ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs font-medium text-blue-300">
                            <svg
                              className="w-3.5 h-3.5 animate-spin"
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
                            <span>Downloading...</span>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                            Click to explore →
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Floating decorative elements for "sea" feel */}
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400/20 rounded-full animate-pulse"></div>
            <div
              className="absolute top-3/4 right-1/3 w-3 h-3 bg-purple-400/20 rounded-full animate-pulse"
              style={{ animationDelay: '1s' }}
            ></div>
            <div
              className="absolute top-1/2 right-1/4 w-2 h-2 bg-cyan-400/20 rounded-full animate-pulse"
              style={{ animationDelay: '2s' }}
            ></div>
          </div>

          {/* LSP Features Section */}
          <div className="mb-16 relative bg-gradient-to-br from-gray-800/20 to-gray-800/10 border border-gray-700/30 rounded-xl p-6 sm:p-8 overflow-hidden opacity-70">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-50 rounded-xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-2xl opacity-60">⚡</div>
                <div>
                  <h2 className="text-xl font-bold text-gray-300 mb-1">
                    Powered by Language Server Protocol
                  </h2>
                  <p className="text-xs text-gray-500">
                    Professional-grade code intelligence powered by{' '}
                    <a
                      href="https://microsoft.github.io/language-server-protocol/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500/70 hover:text-blue-400 underline"
                    >
                      Microsoft's LSP
                    </a>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {/* Hover Documentation */}
                <div className="p-4 bg-gray-900/30 border border-gray-700/30 rounded-lg hover:border-gray-600/50 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-lg opacity-60">💡</div>
                    <h3 className="text-xs font-semibold text-gray-400">Rich Hover Tooltips</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Hover over any symbol to see function signatures, struct members, documentation
                    comments, and usage statistics. Get instant context without leaving your code.
                  </p>
                </div>

                {/* Go to Definition */}
                <div className="p-4 bg-gray-900/30 border border-gray-700/30 rounded-lg hover:border-gray-600/50 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-lg opacity-60">🔍</div>
                    <h3 className="text-xs font-semibold text-gray-400">Go to Definition</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Press{' '}
                    <kbd className="px-1.5 py-0.5 bg-gray-800/50 border border-gray-700/50 rounded text-xs">
                      F12
                    </kbd>{' '}
                    or{' '}
                    <kbd className="px-1.5 py-0.5 bg-gray-800/50 border border-gray-700/50 rounded text-xs">
                      Ctrl+Click
                    </kbd>{' '}
                    to jump directly to symbol definitions. Navigate codebases like a pro.
                  </p>
                </div>

                {/* Find All References */}
                <div className="p-4 bg-gray-900/30 border border-gray-700/30 rounded-lg hover:border-gray-600/50 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-lg opacity-60">📊</div>
                    <h3 className="text-xs font-semibold text-gray-400">Find All References</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Press{' '}
                    <kbd className="px-1.5 py-0.5 bg-gray-800/50 border border-gray-700/50 rounded text-xs">
                      Shift+F12
                    </kbd>{' '}
                    to find every usage of a symbol across the codebase. Understand impact and
                    dependencies instantly.
                  </p>
                </div>

                {/* Code Lens */}
                <div className="p-4 bg-gray-900/30 border border-gray-700/30 rounded-lg hover:border-gray-600/50 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-lg opacity-60">👁️</div>
                    <h3 className="text-xs font-semibold text-gray-400">Code Lens</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    See reference counts inline above every definition. Click to explore all usages
                    and understand code relationships at a glance.
                  </p>
                </div>

                {/* Cross-Reference Analysis */}
                <div className="p-4 bg-gray-900/30 border border-gray-700/30 rounded-lg hover:border-gray-600/50 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-lg opacity-60">🔗</div>
                    <h3 className="text-xs font-semibold text-gray-400">
                      Cross-Reference Analysis
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Discover related symbols and dependencies automatically. See how functions,
                    structs, and classes interconnect throughout the codebase.
                  </p>
                </div>

                {/* Multi-Language Support */}
                <div className="p-4 bg-gray-900/30 border border-gray-700/30 rounded-lg hover:border-gray-600/50 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-lg opacity-60">🌐</div>
                    <h3 className="text-xs font-semibold text-gray-400">C & C++ Support</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Full LSP support for C and C++ codebases. Parse structs, classes, functions, and
                    macros with intelligent symbol resolution.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-700/30">
                <p className="text-xs text-gray-600 leading-relaxed">
                  <strong className="text-gray-500">Built on industry standards:</strong> The same
                  Language Server Protocol used by VS Code, enabling rich code intelligence without
                  requiring local development environments. Explore massive codebases with
                  professional IDE features in your browser.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer with Community Links */}
      <footer className="w-full py-8 px-4 border-t border-gray-800/50 relative z-10">
        <div className="w-full max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left Column - Community Header */}
            <div className="lg:col-span-1">
              <h3 className="text-lg font-semibold text-gray-200 mb-2">Join Our Community</h3>
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                Connect with fellow developers, share your discoveries, and contribute to making
                code exploration better for everyone.
              </p>
              <div className="mb-3">
                <p className="text-sm text-gray-300 font-medium mb-1">
                  🚀 Help us build the future of code exploration
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Add new features • Fix bugs • Improve documentation • Share feedback
                </p>
              </div>

              {/* Meta + contribution links */}
              <div className="mt-6 pt-4 border-t border-gray-800/50">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                  <span>Open-source</span>
                  <span aria-hidden="true">•</span>
                  <span>Built by the community, for the community</span>
                </div>
              </div>
            </div>

            {/* Right Column - Community Links */}
            <div className="lg:col-span-1 space-y-4">
              {SOCIAL_LINKS.map((link, index) => {
                const IconComponent = link.icon;
                const isGitHub = link.name === 'GitHub';

                return isGitHub ? (
                  <div
                    key={index}
                    className={`group flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 text-gray-400 transition-all duration-300 hover:border-gray-600 hover:shadow-lg hover:shadow-gray-900/50 hover:text-gray-200 w-full ${link.color} border-green-500/30 bg-gradient-to-r from-green-500/10 to-blue-500/10`}
                    title={link.title}
                    aria-label={link.title}
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 flex-1 min-w-0"
                      aria-label={link.title}
                      title={link.title}
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
                        aria-label="🐛 Report an issue"
                        title="Report an issue"
                      >
                        <span className="text-xs font-medium text-gray-300">🐛 Issue</span>
                      </a>
                      <a
                        href="https://github.com/pkill37/explorar.dev/pulls"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-gradient-to-r from-gray-500/10 to-gray-500/5 border border-gray-500/20 rounded-md hover:border-gray-400/40 transition-colors"
                        aria-label="📝 Submit a PR"
                        title="Submit a PR"
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
                    className={`group flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 text-gray-400 transition-all duration-300 hover:border-gray-600 hover:shadow-lg hover:shadow-gray-900/50 hover:text-gray-200 w-full ${link.color}`}
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
                    {link.name === 'Discord' || link.name === 'Telegram' ? (
                      <div className="ml-auto">
                        <div className="px-2 py-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-md">
                          <span className="text-xs font-medium text-blue-300">Join</span>
                        </div>
                      </div>
                    ) : null}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

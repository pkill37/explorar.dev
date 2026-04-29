export type GuideSparseExpansion = 'strict' | 'directory-expanded' | 'subtree';

export interface RepoStaticBuildConfig {
  guideMode?: 'full' | 'guide-only';
  guideExpansion?: GuideSparseExpansion;
  includeDirs?: string[];
  excludeDirs?: string[];
}

export interface CuratedRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  displayName: string;
  description: string;
  seoDescription: string;
  seoKeywords: string[];
  sitemapPriority: number;
  icon?: string;
  gradient?: string;
  category?: string;
  dimmed?: boolean;
  staticBuild?: RepoStaticBuildConfig;
}

export const CURATED_REPOS: CuratedRepoConfig[] = [
  {
    owner: 'apple-oss-distributions',
    repo: 'xnu',
    branch: 'xnu-12377.1.9',
    displayName: 'XNU Kernel',
    icon: '🍎',
    gradient: 'from-gray-500/10 to-slate-500/10',
    category: 'Operating Systems',
    description:
      "Explore Apple's XNU kernel: the hybrid Mach/BSD core powering macOS and iOS. Study Mach IPC, virtual memory, I/O Kit drivers, and the BSD subsystem.",
    seoDescription:
      "Explore Apple's XNU kernel source code interactively. Study Mach IPC, virtual memory, I/O Kit drivers, BSD internals, and the hybrid kernel architecture behind macOS and iOS.",
    seoKeywords: [
      'XNU',
      'Apple kernel',
      'Mach kernel',
      'BSD kernel',
      'macOS internals',
      'iOS internals',
      'kernel architecture',
      'systems programming',
    ],
    sitemapPriority: 0.9,
  },
  {
    owner: 'torvalds',
    repo: 'linux',
    branch: 'v6.1',
    displayName: 'Linux Kernel',
    icon: '🐧',
    gradient: 'from-orange-500/10 to-red-500/10',
    category: 'Operating Systems',
    description:
      'Explore the Linux kernel source code. Study kernel architecture, system calls, device drivers, and core subsystems.',
    seoDescription:
      'Explore the Linux kernel source code interactively. Study kernel architecture, system calls, device drivers, and core subsystems with guided learning paths.',
    seoKeywords: [
      'Linux kernel',
      'kernel source code',
      'kernel development',
      'system programming',
      'device drivers',
      'kernel architecture',
      'operating systems',
      'Linux internals',
    ],
    sitemapPriority: 0.9,
  },
  {
    owner: 'python',
    repo: 'cpython',
    branch: 'v3.12.0',
    displayName: 'CPython',
    icon: '🐍',
    gradient: 'from-yellow-500/10 to-blue-500/10',
    category: 'Languages',
    description:
      'Explore the Python interpreter source code. Learn how Python works under the hood, from bytecode execution to garbage collection.',
    seoDescription:
      'Explore Python CPython interpreter source code. Learn how Python works under the hood, from bytecode execution to garbage collection and runtime internals.',
    seoKeywords: [
      'CPython',
      'Python source code',
      'Python interpreter',
      'Python internals',
      'bytecode',
      'garbage collection',
      'Python implementation',
      'programming language',
    ],
    sitemapPriority: 0.9,
  },
  {
    owner: 'bminor',
    repo: 'glibc',
    branch: 'glibc-2.39',
    displayName: 'GNU C Library',
    icon: '🖥️',
    gradient: 'from-orange-500/10 to-red-500/10',
    category: 'Operating Systems',
    description:
      'Explore the GNU C Library source code. Study standard C library implementations, system calls, and POSIX compliance.',
    seoDescription:
      'Explore the GNU C Library (glibc) source code. Study standard C library implementations, system calls, POSIX compliance, and C runtime behavior.',
    seoKeywords: [
      'glibc',
      'GNU C Library',
      'C standard library',
      'system calls',
      'POSIX',
      'systems programming',
      'C runtime',
      'libc',
    ],
    sitemapPriority: 0.8,
  },
  {
    owner: 'llvm',
    repo: 'llvm-project',
    branch: 'llvmorg-18.1.0',
    displayName: 'LLVM Project',
    icon: '⚙️',
    gradient: 'from-blue-500/10 to-cyan-500/10',
    category: 'Languages',
    description:
      'Explore the LLVM compiler infrastructure. Study compiler design, optimization passes, and code generation.',
    seoDescription:
      'Explore the LLVM compiler infrastructure source code. Study compiler design, optimization passes, code generation, and modern compiler architecture.',
    seoKeywords: [
      'LLVM',
      'compiler infrastructure',
      'compiler design',
      'code optimization',
      'code generation',
      'compiler architecture',
      'Clang',
      'compiler engineering',
    ],
    sitemapPriority: 0.8,
    dimmed: true,
  },
];

export function toRepoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

export function getCuratedRepo(owner: string, repo: string): CuratedRepoConfig | null {
  return CURATED_REPOS.find((entry) => entry.owner === owner && entry.repo === repo) ?? null;
}

export function isCuratedRepo(owner: string, repo: string): boolean {
  return getCuratedRepo(owner, repo) !== null;
}

export function getCuratedRepoBranch(owner: string, repo: string): string {
  return getCuratedRepo(owner, repo)?.branch ?? '';
}

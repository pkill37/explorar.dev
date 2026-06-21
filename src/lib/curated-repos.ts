export interface CuratedRepoConfig {
  id: string;
  owner: string;
  repo: string;
  /** SEO-friendly canonical route segment (e.g. "/linux-kernel"). */
  slug: string;
  /** Human-readable pinned reference label shown in the UI. */
  ref: string;
  /** Canonical locked revision used for local/static storage and trusted fetches. */
  revision: string;
  /** Guide document that is authored against this exact curated revision. */
  guideId: string;
  displayName: string;
  description: string;
  seoDescription: string;
  seoKeywords: string[];
  sitemapPriority: number;
  icon?: string;
  gradient?: string;
  category?: string;
  dimmed?: boolean;
  /** Filename under /avatars/ (e.g. "gnu.png"). Defaults to "{owner}.png". */
  avatarFile?: string;
  /** URL to fetch the avatar from at build time. Defaults to github.com/{owner}.png */
  buildAvatarUrl?: string;
  /** Optional build-time version marker for refreshing a specific avatar asset. */
  avatarVersion?: string;
}

export const CURATED_REPOS: CuratedRepoConfig[] = [
  {
    id: 'linux-v6.1',
    owner: 'torvalds',
    repo: 'linux',
    slug: 'linux-kernel',
    ref: 'v6.1',
    revision: 'v6.1',
    guideId: 'linux-kernel-guide',
    displayName: 'Linux Kernel',
    icon: '🐧',
    gradient: 'from-orange-500/10 to-red-500/10',
    category: 'Operating Systems',
    avatarFile: 'tux.png',
    buildAvatarUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Tux.svg/256px-Tux.svg.png',
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
    id: 'apple-xnu',
    owner: 'apple-oss-distributions',
    repo: 'xnu',
    slug: 'xnu-kernel',
    ref: 'xnu-12377.1.9',
    revision: 'xnu-12377.1.9',
    guideId: 'xnu-kernel-guide',
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
    id: 'windows-server-2003-anika',
    owner: 'mrcxlinux',
    repo: 'srv03rtm-anika',
    slug: 'windows-server-2003',
    ref: '9e4d6bae9ed79e542f0f3ab463d6b00866019ec1',
    revision: '9e4d6bae9ed79e542f0f3ab463d6b00866019ec1',
    guideId: 'windows-server-2003-guide',
    displayName: 'Windows Server 2003 Source Tree',
    icon: '🪟',
    gradient: 'from-sky-500/10 to-blue-500/10',
    category: 'Operating Systems',
    avatarFile: 'mrcxlinux.svg',
    avatarVersion: '2',
    description:
      'Explore the Windows Server 2003 source tree, with focus on its build layout, core subsystem families, and server-oriented components.',
    seoDescription:
      'Explore the Windows Server 2003 source tree interactively. Study the build layout, subsystem organization, server components, networking stack, and developer tooling behind the NT 5.2 codebase.',
    seoKeywords: [
      'Windows Server 2003',
      'Windows internals',
      'NT source code',
      'source tree',
      'Razzle build',
      'server operating system',
      'systems programming',
      'Windows source code',
    ],
    sitemapPriority: 0.75,
  },
  {
    id: 'littlekernel-lk',
    owner: 'littlekernel',
    repo: 'lk',
    slug: 'little-kernel',
    ref: 'a521fe60e1a16d5670fe24b7fca2c5155b3339c4',
    revision: 'a521fe60e1a16d5670fe24b7fca2c5155b3339c4',
    guideId: 'littlekernel-lk-guide',
    displayName: 'LK Embedded Kernel',
    icon: '🧩',
    gradient: 'from-emerald-500/10 to-cyan-500/10',
    category: 'Operating Systems',
    description:
      'Explore LK, a small SMP-aware embedded kernel used in bootloaders and bring-up environments across many architectures.',
    seoDescription:
      'Explore the Little Kernel (LK) embedded kernel source code. Study its tiny kernel core, platform ports, target configuration model, and modular embedded build system.',
    seoKeywords: [
      'Little Kernel',
      'LK kernel',
      'embedded kernel',
      'bootloader kernel',
      'RTOS',
      'kernel bring-up',
      'embedded systems',
      'platform porting',
    ],
    sitemapPriority: 0.8,
  },
  {
    id: 'sel4-15.0.0',
    owner: 'seL4',
    repo: 'seL4',
    slug: 'sel4-microkernel',
    ref: '15.0.0',
    revision: '15.0.0',
    guideId: 'sel4-guide',
    displayName: 'seL4 Microkernel',
    icon: '⚙️',
    gradient: 'from-slate-500/10 to-zinc-500/10',
    category: 'Operating Systems',
    description:
      'Explore seL4, the formally verified microkernel with a capability-based kernel model, generated ABI bindings, and architecture-specific ports.',
    seoDescription:
      'Explore the seL4 microkernel source code interactively. Study capability-based isolation, kernel boot flow, generated syscalls, scheduling, and architecture ports in seL4 15.0.0.',
    seoKeywords: [
      'seL4',
      'microkernel',
      'capability kernel',
      'formal verification',
      'kernel boot',
      'syscall generation',
      'operating systems',
      'systems programming',
    ],
    sitemapPriority: 0.8,
  },
  {
    id: 'reactos',
    owner: 'reactos',
    repo: 'reactos',
    slug: 'reactos',
    ref: '0.4.16',
    revision: '0.4.16',
    guideId: 'reactos-guide',
    displayName: 'ReactOS',
    icon: '🪟',
    gradient: 'from-sky-500/10 to-cyan-500/10',
    category: 'Operating Systems',
    description:
      'Explore ReactOS, a Windows-compatible open source operating system focused on NT kernel, Win32, and driver compatibility.',
    seoDescription:
      'Explore the ReactOS source code interactively. Study its NT kernel architecture, Win32 subsystem, driver model, boot flow, and Windows compatibility layers.',
    seoKeywords: [
      'ReactOS',
      'Windows-compatible OS',
      'NT kernel',
      'Win32',
      'driver compatibility',
      'operating system internals',
      'systems programming',
      'open source OS',
    ],
    sitemapPriority: 0.75,
  },
  {
    id: 'python-cpython-3.12.0',
    owner: 'python',
    repo: 'cpython',
    slug: 'cpython',
    ref: 'v3.12.0',
    revision: 'v3.12.0',
    guideId: 'cpython-guide',
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
    id: 'glibc-2.39',
    owner: 'bminor',
    repo: 'glibc',
    slug: 'gnu-c-library',
    ref: 'glibc-2.39',
    revision: 'glibc-2.39',
    guideId: 'glibc-guide',
    displayName: 'GNU C Library',
    icon: '🖥️',
    gradient: 'from-orange-500/10 to-red-500/10',
    category: 'Operating Systems',
    avatarFile: 'gnu.png',
    buildAvatarUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Heckert_GNU_white.svg/256px-Heckert_GNU_white.svg.png',
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
    id: 'llvm-18.1.0',
    owner: 'llvm',
    repo: 'llvm-project',
    slug: 'llvm-project',
    ref: 'llvmorg-18.1.0',
    revision: 'llvmorg-18.1.0',
    guideId: 'llvm-guide',
    displayName: 'LLVM Project',
    icon: '⚙️',
    gradient: 'from-blue-500/10 to-cyan-500/10',
    category: 'Languages',
    avatarFile: 'llvm-dragon.png',
    buildAvatarUrl: 'https://llvm.org/img/DragonMedium.png',
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
  },
];

function validateCuratedRepos(repos: CuratedRepoConfig[]): void {
  const ids = new Set<string>();
  const repoKeys = new Set<string>();
  const guideIds = new Set<string>();
  const slugs = new Set<string>();

  for (const repo of repos) {
    if (!repo.id || !repo.slug || !repo.ref || !repo.revision || !repo.guideId) {
      throw new Error(
        `Curated repo ${repo.owner}/${repo.repo} is missing required lock fields (id/slug/ref/revision/guideId).`
      );
    }

    if (ids.has(repo.id)) {
      throw new Error(`Duplicate curated repo id: ${repo.id}`);
    }
    ids.add(repo.id);

    const repoKey = toRepoKey(repo.owner, repo.repo);
    if (repoKeys.has(repoKey)) {
      throw new Error(`Duplicate curated repo key: ${repoKey}`);
    }
    repoKeys.add(repoKey);

    if (guideIds.has(repo.guideId)) {
      throw new Error(`Duplicate curated guide id: ${repo.guideId}`);
    }
    guideIds.add(repo.guideId);

    if (slugs.has(repo.slug)) {
      throw new Error(`Duplicate curated repo slug: ${repo.slug}`);
    }
    slugs.add(repo.slug);
  }
}

export function toRepoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

export function getCuratedRepo(owner: string, repo: string): CuratedRepoConfig | null {
  return CURATED_REPOS.find((entry) => entry.owner === owner && entry.repo === repo) ?? null;
}

export function getCuratedRepoBySlug(slug: string): CuratedRepoConfig | null {
  return CURATED_REPOS.find((entry) => entry.slug === slug) ?? null;
}

export function isCuratedRepo(owner: string, repo: string): boolean {
  return getCuratedRepo(owner, repo) !== null;
}

export function getCuratedRepoRevision(owner: string, repo: string): string {
  return getCuratedRepo(owner, repo)?.revision ?? '';
}

export function getCuratedRepoRef(owner: string, repo: string): string {
  return getCuratedRepo(owner, repo)?.ref ?? '';
}

export function getCuratedRepoId(owner: string, repo: string): string {
  return getCuratedRepo(owner, repo)?.id ?? '';
}

export function getCuratedRepoPath(owner: string, repo: string): string {
  const config = getCuratedRepo(owner, repo);
  return config ? `/${config.slug}` : `/${owner}/${repo}`;
}

validateCuratedRepos(CURATED_REPOS);

import type { Metadata } from 'next';
import Script from 'next/script';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://explorar.dev';

// For static export, we need to provide generateStaticParams in layouts with dynamic segments
export async function generateStaticParams() {
  return [
    { owner: 'torvalds', repo: 'linux' },
    { owner: 'python', repo: 'cpython' },
    { owner: 'bminor', repo: 'glibc' },
    { owner: 'llvm', repo: 'llvm-project' },
  ];
}

// Repository-specific metadata and descriptions
const repoMetadata: Record<string, { description: string; keywords: string[] }> = {
  'torvalds/linux': {
    description:
      'Explore the Linux kernel source code interactively. Study kernel architecture, system calls, device drivers, and core subsystems with guided learning paths. Perfect for kernel developers and systems programmers.',
    keywords: [
      'Linux kernel',
      'kernel source code',
      'kernel development',
      'system programming',
      'device drivers',
      'kernel architecture',
      'operating systems',
      'kernel study',
      'Linux internals',
    ],
  },
  'python/cpython': {
    description:
      'Explore Python CPython interpreter source code. Learn how Python works under the hood, from bytecode execution to garbage collection. Study the reference implementation of the Python programming language.',
    keywords: [
      'CPython',
      'Python source code',
      'Python interpreter',
      'Python internals',
      'bytecode',
      'garbage collection',
      'Python implementation',
      'programming language',
    ],
  },
  'bminor/glibc': {
    description:
      'Explore the GNU C Library (glibc) source code. Study standard C library implementations, system calls, and POSIX compliance. Essential for systems programming and understanding C runtime behavior.',
    keywords: [
      'glibc',
      'GNU C Library',
      'C standard library',
      'system calls',
      'POSIX',
      'systems programming',
      'C runtime',
      'libc',
    ],
  },
  'llvm/llvm-project': {
    description:
      'Explore the LLVM compiler infrastructure source code. Study compiler design, optimization passes, code generation, and modern compiler architecture. Perfect for compiler engineers and language implementers.',
    keywords: [
      'LLVM',
      'compiler infrastructure',
      'compiler design',
      'code optimization',
      'code generation',
      'compiler architecture',
      'Clang',
      'compiler engineering',
    ],
  },
};

function getRepoMetadata(owner: string, repo: string) {
  const key = `${owner}/${repo}`;
  return (
    repoMetadata[key] || {
      description: `Explore ${owner}/${repo} source code with an interactive VS Code-like interface. Browse files, read code, and learn from this repository with guided learning paths.`,
      keywords: [
        'source code browser',
        'code exploration',
        'interactive learning',
        'GitHub repository',
        'code study',
        'software development',
      ],
    }
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
  const { owner, repo } = await params;
  const repoLabel = `${owner}/${repo}`;
  const { description, keywords } = getRepoMetadata(owner, repo);

  return {
    title: `${repoLabel} | explorar.dev`,
    description,
    keywords: [
      ...keywords,
      repoLabel,
      owner,
      repo,
      'source code explorer',
      'interactive code browser',
    ],
    openGraph: {
      title: `${repoLabel} | explorar.dev`,
      description,
      url: `${siteUrl}/${owner}/${repo}`,
      type: 'website',
      siteName: 'explorar.dev',
      images: [
        {
          url: `${siteUrl}/og.png`,
          width: 1200,
          height: 630,
          alt: `${repoLabel} - Source Code Explorer`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${repoLabel} | explorar.dev`,
      description,
      images: [`${siteUrl}/og.png`],
      creator: '@explorardev',
    },
    alternates: {
      canonical: `${siteUrl}/${owner}/${repo}`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

interface RepositoryLayoutProps {
  children: React.ReactNode;
  params: Promise<{ owner: string; repo: string }>;
}

export default async function RepositoryLayout({ children, params }: RepositoryLayoutProps) {
  const { owner, repo } = await params;
  const repoLabel = `${owner}/${repo}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://explorar.dev';
  const repoUrl = `${siteUrl}/${owner}/${repo}`;
  const githubUrl = `https://github.com/${owner}/${repo}`;

  // SoftwareSourceCode structured data
  const softwareSourceCodeSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: repoLabel,
    codeRepository: githubUrl,
    url: repoUrl,
    description: `Interactive source code browser for ${repoLabel}`,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  // BreadcrumbList structured data
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: owner,
        item: `${siteUrl}/${owner}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: repo,
        item: repoUrl,
      },
    ],
  };

  return (
    <>
      <Script
        id="software-source-code-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareSourceCodeSchema),
        }}
      />
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
      {children}
    </>
  );
}

import type { Metadata } from 'next';
import Script from 'next/script';
import { CURATED_REPOS, getCuratedRepo } from '@/lib/curated-repos';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://explorar.dev';

// For static export, we need to provide generateStaticParams in layouts with dynamic segments
export async function generateStaticParams() {
  return CURATED_REPOS.map(({ owner, repo }) => ({ owner, repo }));
}

// Repository-specific metadata and descriptions
function getRepoMetadata(owner: string, repo: string) {
  const config = getCuratedRepo(owner, repo);

  if (config) {
    return {
      description: config.seoDescription,
      keywords: config.seoKeywords,
    };
  }

  return {
    description: `Explore ${owner}/${repo} source code with an interactive VS Code-like interface. Browse files, read code, and learn from this repository with guided learning paths.`,
    keywords: [
      'source code browser',
      'code exploration',
      'interactive learning',
      'GitHub repository',
      'code study',
      'software development',
    ],
  };
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

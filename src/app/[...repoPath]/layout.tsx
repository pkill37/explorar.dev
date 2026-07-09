import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { getCuratedRepoRouteParams, resolveCuratedRepoRoute } from '@/lib/curated-repos';

export const dynamicParams = false;

export async function generateStaticParams() {
  return getCuratedRepoRouteParams();
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://explorar.dev';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ repoPath: string[] }>;
}): Promise<Metadata> {
  const { repoPath } = await params;
  const resolved = resolveCuratedRepoRoute(repoPath);

  if (!resolved) {
    return {};
  }

  const { config, canonicalPath, isLegacyPath } = resolved;
  const repoLabel = `${config.owner}/${config.repo}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;

  if (isLegacyPath) {
    return {
      title: `${config.displayName} | explorar.dev`,
      description: `Legacy route for ${config.displayName}. Redirecting to the canonical explorar.dev URL.`,
      alternates: {
        canonical: canonicalUrl,
      },
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  return {
    title: `${config.displayName} | explorar.dev`,
    description: config.seoDescription,
    keywords: [
      ...config.seoKeywords,
      repoLabel,
      config.owner,
      config.repo,
      config.displayName,
      'source code explorer',
      'interactive code browser',
    ],
    openGraph: {
      title: `${config.displayName} | explorar.dev`,
      description: config.seoDescription,
      url: canonicalUrl,
      type: 'website',
      siteName: 'explorar.dev',
      images: [
        {
          url: `${siteUrl}/og.png`,
          width: 1200,
          height: 630,
          alt: `${config.displayName} - Source Code Explorer`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${config.displayName} | explorar.dev`,
      description: config.seoDescription,
      images: [`${siteUrl}/og.png`],
      creator: '@explorardev',
    },
    alternates: {
      canonical: canonicalUrl,
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

interface RepositoryRouteLayoutProps {
  children: React.ReactNode;
  params: Promise<{ repoPath: string[] }>;
}

export default async function RepositoryRouteLayout({
  children,
  params,
}: RepositoryRouteLayoutProps) {
  const { repoPath } = await params;
  const resolved = resolveCuratedRepoRoute(repoPath);

  if (!resolved) {
    notFound();
  }

  if (resolved.isLegacyPath) {
    return children;
  }

  const { config, canonicalPath } = resolved;
  const repoLabel = `${config.owner}/${config.repo}`;
  const repoUrl = `${siteUrl}${canonicalPath}`;
  const githubUrl = `https://github.com/${config.owner}/${config.repo}`;

  const softwareSourceCodeSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: config.displayName,
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
        name: config.displayName,
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

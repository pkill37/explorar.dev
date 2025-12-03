import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://explorar.dev';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
  const { owner, repo } = await params;
  const repoLabel = `${owner}/${repo}`;

  return {
    title: `${repoLabel} | explorar.dev`,
    description: `Explore ${repoLabel} source code with an interactive VS Code-like interface. Browse files, read code, and learn from this repository.`,
    openGraph: {
      title: `${repoLabel} | explorar.dev`,
      description: `Explore ${repoLabel} source code with an interactive code browser.`,
      url: `${siteUrl}/${owner}/${repo}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${repoLabel} | explorar.dev`,
      description: `Explore ${repoLabel} source code.`,
    },
    alternates: {
      canonical: `${siteUrl}/${owner}/${repo}`,
    },
  };
}

export default function RepositoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}

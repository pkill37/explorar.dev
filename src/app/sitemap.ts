import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://explorar.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const commonRepos = [
    { owner: 'torvalds', repo: 'linux', priority: 0.9 },
    { owner: 'python', repo: 'cpython', priority: 0.9 },
    { owner: 'bminor', repo: 'glibc', priority: 0.8 },
    { owner: 'llvm', repo: 'llvm-project', priority: 0.8 },
  ];

  const baseDate = new Date();

  return [
    {
      url: siteUrl,
      lastModified: baseDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/linux-kernel-explorer`,
      lastModified: baseDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...commonRepos.map(({ owner, repo, priority }) => ({
      url: `${siteUrl}/${owner}/${repo}`,
      lastModified: baseDate,
      changeFrequency: 'weekly' as const,
      priority,
    })),
  ];
}

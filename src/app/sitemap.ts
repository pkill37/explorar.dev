import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://explorar.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const commonRepos = [
    { owner: 'torvalds', repo: 'linux' },
    { owner: 'python', repo: 'cpython' },
    { owner: 'bminor', repo: 'glibc' },
    { owner: 'llvm', repo: 'llvm-project' },
  ];

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/linux-kernel-explorer`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...commonRepos.map(({ owner, repo }) => ({
      url: `${siteUrl}/${owner}/${repo}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}

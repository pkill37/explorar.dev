import { MetadataRoute } from 'next';
import { CURATED_REPOS } from '@/lib/curated-repos';

export const dynamic = 'force-static';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://explorar.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseDate = new Date();

  return [
    {
      url: siteUrl,
      lastModified: baseDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...CURATED_REPOS.map(({ owner, repo, sitemapPriority }) => ({
      url: `${siteUrl}/${owner}/${repo}`,
      lastModified: baseDate,
      changeFrequency: 'weekly' as const,
      priority: sitemapPriority,
    })),
  ];
}

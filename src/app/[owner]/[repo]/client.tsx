'use client';

import { notFound } from 'next/navigation';
import KernelExplorer from '@/components/KernelExplorer';
import { getProjectConfig } from '@/lib/project-guides';

interface RepositoryExplorerClientProps {
  owner: string;
  repo: string;
}

export default function RepositoryExplorerClient({ owner, repo }: RepositoryExplorerClientProps) {
  // Check if this repository is curated/prepared
  const projectConfig = getProjectConfig(owner, repo);

  // If not curated, show not found
  if (!projectConfig) {
    notFound();
  }

  // Otherwise, show the explorer
  return <KernelExplorer owner={owner} repo={repo} />;
}

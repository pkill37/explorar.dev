'use client';

import KernelExplorer from '@/components/KernelExplorer';
import ContributeScreen from '@/components/ContributeScreen';
import { getProjectConfig } from '@/lib/project-guides';

interface RepositoryExplorerClientProps {
  owner: string;
  repo: string;
}

export default function RepositoryExplorerClient({ owner, repo }: RepositoryExplorerClientProps) {
  // Check if this repository is curated/prepared
  const projectConfig = getProjectConfig(owner, repo);

  // If not curated, show the contribute screen
  if (!projectConfig) {
    return <ContributeScreen owner={owner} repo={repo} />;
  }

  // Otherwise, show the explorer
  return <KernelExplorer owner={owner} repo={repo} />;
}

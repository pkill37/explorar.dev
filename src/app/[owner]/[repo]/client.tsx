'use client';

import KernelExplorer from '@/components/KernelExplorer';

interface RepositoryExplorerClientProps {
  owner: string;
  repo: string;
}

export default function RepositoryExplorerClient({ owner, repo }: RepositoryExplorerClientProps) {
  return <KernelExplorer owner={owner} repo={repo} />;
}

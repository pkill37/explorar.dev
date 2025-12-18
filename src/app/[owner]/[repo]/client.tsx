'use client';

import { notFound } from 'next/navigation';
import { useEffect } from 'react';
import KernelExplorer from '@/components/KernelExplorer';
import { getProjectConfig } from '@/lib/project-guides';
import { trackExploredRepo } from '@/lib/worker-api';
import { useAuth } from '@/contexts/AuthContext';

interface RepositoryExplorerClientProps {
  owner: string;
  repo: string;
}

export default function RepositoryExplorerClient({ owner, repo }: RepositoryExplorerClientProps) {
  const { isAuthenticated } = useAuth();

  // Check if this repository is curated/prepared
  const projectConfig = getProjectConfig(owner, repo);

  // Track repository exploration if authenticated
  useEffect(() => {
    if (isAuthenticated && owner && repo) {
      trackExploredRepo(owner, repo).catch((error) => {
        console.error('Failed to track explored repo:', error);
      });
    }
  }, [isAuthenticated, owner, repo]);

  // If not curated, show not found
  if (!projectConfig) {
    notFound();
  }

  // Otherwise, show the explorer
  return <KernelExplorer owner={owner} repo={repo} />;
}

'use client';

import React, { useState } from 'react';
import { downloadBranch, DownloadProgress } from '@/lib/github-archive';
import { getTrustedVersions } from '@/lib/github-api';
import { repositoryExists, getGitHubRepoIdentifier } from '@/lib/repo-storage';

interface GitHubRepo {
  owner: string;
  repo: string;
  displayName: string;
  description?: string;
}

interface RepoSetupCardProps {
  repo: GitHubRepo;
  onDownloadComplete?: (owner: string, repo: string) => void;
  onDownloadStart?: (owner: string, repo: string) => void;
}

export default function RepoSetupCard({
  repo,
  onDownloadComplete,
  onDownloadStart,
}: RepoSetupCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if repository is already available
  React.useEffect(() => {
    const checkAvailability = async () => {
      try {
        const identifier = getGitHubRepoIdentifier(repo.owner, repo.repo);
        const exists = await repositoryExists('github', identifier);
        setIsAvailable(exists);
      } catch (err) {
        console.warn('Failed to check repository availability:', err);
        setIsAvailable(false);
      }
    };

    checkAvailability();
  }, [repo.owner, repo.repo]);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    onDownloadStart?.(repo.owner, repo.repo);

    try {
      // Get trusted branches
      const trustedBranches = getTrustedVersions(repo.owner, repo.repo);
      const firstBranch = trustedBranches[0];

      if (!firstBranch) {
        throw new Error('No trusted branches available for this repository');
      }

      // Download first trusted branch
      await downloadBranch(repo.owner, repo.repo, firstBranch, (progress) => {
        setDownloadProgress(progress);
      });

      setIsAvailable(true);
      onDownloadComplete?.(repo.owner, repo.repo);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      setError(errorMessage);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const trustedBranches = getTrustedVersions(repo.owner, repo.repo);

  return (
    <div className="p-4 border border-[var(--vscode-widget-border)] rounded hover:bg-[var(--vscode-list-hoverBackground)] transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="font-semibold text-sm mb-1">{repo.displayName}</div>
          <div className="text-xs text-[var(--vscode-descriptionForeground)] mb-2">
            {repo.owner}/{repo.repo}
          </div>
          {repo.description && <div className="text-xs opacity-70 mb-2">{repo.description}</div>}
          <div className="text-xs opacity-60">Branches: {trustedBranches.join(', ')}</div>
        </div>

        <div className="ml-3">
          {isAvailable === null ? (
            <div className="px-3 py-1 text-xs bg-[var(--vscode-button-secondaryBackground)] rounded">
              Checking...
            </div>
          ) : isAvailable ? (
            <div className="px-3 py-1 text-xs bg-[var(--vscode-textLink-foreground)] text-[var(--vscode-button-foreground)] rounded">
              ✓ Downloaded
            </div>
          ) : (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-3 py-1 text-xs bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              {isDownloading ? 'Downloading...' : 'Download'}
            </button>
          )}
        </div>
      </div>

      {/* Download Progress */}
      {downloadProgress && (
        <div className="mt-3 space-y-2">
          <div className="w-full bg-[var(--vscode-progressBar-background)] rounded-full h-1.5">
            <div
              className="bg-[var(--vscode-progressBar-foreground)] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress.progress}%` }}
            />
          </div>
          <div className="text-xs opacity-70">{downloadProgress.message}</div>
          {downloadProgress.phase === 'downloading' &&
            downloadProgress.bytesDownloaded &&
            downloadProgress.totalBytes && (
              <div className="text-xs opacity-50">
                {Math.round((downloadProgress.bytesDownloaded / 1024 / 1024) * 10) / 10} MB /{' '}
                {Math.round((downloadProgress.totalBytes / 1024 / 1024) * 10) / 10} MB
              </div>
            )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-3 p-2 bg-[var(--vscode-inputValidation-errorBackground)] border border-[var(--vscode-inputValidation-errorBorder)] rounded">
          <div className="text-xs text-[var(--vscode-inputValidation-errorForeground)]">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}

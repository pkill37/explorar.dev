'use client';

import React, { useState, useEffect } from 'react';
import {
  getStorageUsage,
  formatBytes,
  clearRepository,
  RepositoryMetadata,
  parseGitHubRepoIdentifier,
} from '@/lib/repo-storage';

interface StorageUsageProps {
  onRepositoryDeleted?: () => void;
}

export default function StorageUsage({ onRepositoryDeleted }: StorageUsageProps) {
  const [usage, setUsage] = useState<{
    totalSize: number;
    repositories: RepositoryMetadata[];
    availableSpace?: number;
  }>({ totalSize: 0, repositories: [], availableSpace: undefined });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsage = async () => {
    try {
      setIsLoading(true);
      const storageUsage = await getStorageUsage();
      setUsage(storageUsage);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storage usage');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsage();
  }, []);

  const handleDeleteRepository = async (repo: RepositoryMetadata) => {
    if (
      !confirm(
        `Are you sure you want to delete "${repo.displayName}"? This will remove all downloaded files.`
      )
    ) {
      return;
    }

    try {
      await clearRepository(repo.source, repo.identifier);
      await loadUsage();
      onRepositoryDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete repository');
    }
  };

  const getStoragePercentage = (): number => {
    if (!usage.availableSpace || usage.availableSpace <= 0) return 0;
    const totalSpace = usage.totalSize + usage.availableSpace;
    return Math.round((usage.totalSize / totalSpace) * 100);
  };

  if (isLoading) {
    return (
      <div className="p-4 border border-[var(--vscode-widget-border)] rounded">
        <div className="text-sm">Loading storage usage...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)] rounded">
        <div className="text-sm text-[var(--vscode-inputValidation-errorForeground)]">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Storage Usage */}
      <div className="p-4 bg-[var(--vscode-editor-inactiveSelectionBackground)] border border-[var(--vscode-widget-border)] rounded">
        <div className="flex justify-between items-center mb-2">
          <div className="font-semibold text-sm">Storage Usage</div>
          <button
            onClick={loadUsage}
            className="text-xs px-2 py-1 bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] rounded"
          >
            Refresh
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Used:</span>
            <span>{formatBytes(usage.totalSize)}</span>
          </div>

          {usage.availableSpace !== undefined && (
            <>
              <div className="flex justify-between text-sm">
                <span>Available:</span>
                <span>{formatBytes(usage.availableSpace)}</span>
              </div>

              <div className="w-full bg-[var(--vscode-progressBar-background)] rounded-full h-2">
                <div
                  className="bg-[var(--vscode-progressBar-foreground)] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getStoragePercentage()}%` }}
                />
              </div>

              <div className="text-xs opacity-70 text-center">{getStoragePercentage()}% used</div>
            </>
          )}

          <div className="text-xs opacity-70">
            {usage.repositories.length} repositor{usage.repositories.length !== 1 ? 'ies' : 'y'}
          </div>
        </div>
      </div>

      {/* Repository List */}
      {usage.repositories.length > 0 && (
        <div className="space-y-2">
          <div className="font-semibold text-sm">Repositories</div>

          {usage.repositories
            .filter((repo) => repo.source === 'github')
            .map((repo) => (
              <div
                key={`${repo.source}-${repo.identifier}`}
                className="p-3 border border-[var(--vscode-widget-border)] rounded hover:bg-[var(--vscode-list-hoverBackground)]"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{repo.displayName}</div>
                    <div className="text-xs text-[var(--vscode-descriptionForeground)] mt-1">
                      📦 GitHub Repository
                      {(() => {
                        try {
                          const { owner, repo: repoName } = parseGitHubRepoIdentifier(
                            repo.identifier
                          );
                          return ` • ${owner}/${repoName}`;
                        } catch {
                          return '';
                        }
                      })()}
                    </div>
                    <div className="text-xs opacity-70 mt-1">
                      {repo.branches.length} branch{repo.branches.length !== 1 ? 'es' : ''} •{' '}
                      {formatBytes(repo.totalSize)}
                    </div>
                    <div className="text-xs opacity-50 mt-1">
                      Branches: {repo.branches.join(', ')}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteRepository(repo)}
                    className="ml-2 px-2 py-1 text-xs bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Storage Tips */}
      <div className="p-3 bg-[var(--vscode-textBlockQuote-background)] border-l-4 border-[var(--vscode-textBlockQuote-border)] rounded-r">
        <div className="text-sm font-medium mb-1">💡 Storage Tips</div>
        <ul className="text-xs space-y-1 opacity-80">
          <li>• Downloaded repositories are stored locally for offline access</li>
          <li>• Each branch is downloaded separately when first accessed</li>
          <li>• Delete unused repositories to free up space</li>
          <li>• Storage is persistent across browser sessions</li>
        </ul>
      </div>
    </div>
  );
}

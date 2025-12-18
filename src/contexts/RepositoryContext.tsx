'use client';

// Repository Context for managing repository state across components
// Handles GitHub-downloaded repositories

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  getAvailableBranches,
  repositoryExists,
  getStorageUsage,
  parseGitHubRepoIdentifier,
} from '@/lib/repo-storage';
import {
  downloadBranch,
  getBranchDownloadStatus,
  DownloadProgress,
  BranchDownloadStatus,
} from '@/lib/github-archive';
import { getTrustedVersion, filterUnstableBranches } from '@/lib/github-api';
import { isCuratedRepo } from '@/lib/repo-static';

export interface RepositoryState {
  // Current repository
  source: 'github' | 'uploaded' | null;
  identifier: string | null; // owner~repo for GitHub, repoId for uploaded
  displayName: string | null;

  // Branch management
  currentBranch: string | null;
  availableBranches: string[];
  trustedBranches: string[]; // Only for GitHub repos

  // Status
  isLoading: boolean;
  isSetup: boolean; // Whether any repository is configured
  error: string | null;

  // Download status (for GitHub repos)
  downloadStatus: Record<string, BranchDownloadStatus>;
  downloadProgress: DownloadProgress | null;
}

export interface RepositoryActions {
  // Repository management
  setRepository: (
    source: 'github' | 'uploaded',
    identifier: string,
    displayName: string
  ) => Promise<void>;
  clearRepository: () => void;
  checkSetupStatus: () => Promise<boolean>;

  // Branch management
  switchBranch: (branch: string) => Promise<void>;
  refreshBranches: () => Promise<void>;

  // GitHub-specific actions
  downloadBranchIfNeeded: (branch: string) => Promise<void>;

  // Utility
  getRepoInfo: () => { owner?: string; repo?: string; repoId?: string } | null;
}

interface RepositoryContextValue extends RepositoryState, RepositoryActions {}

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

interface RepositoryProviderProps {
  children: ReactNode;
}

export function RepositoryProvider({ children }: RepositoryProviderProps) {
  const [state, setState] = useState<RepositoryState>({
    source: null,
    identifier: null,
    displayName: null,
    currentBranch: null,
    availableBranches: [],
    trustedBranches: [],
    isLoading: false,
    isSetup: false,
    error: null,
    downloadStatus: {},
    downloadProgress: null,
  });

  // Check if any repository is set up
  const checkSetupStatus = useCallback(async (): Promise<boolean> => {
    try {
      const usage = await getStorageUsage();
      const hasRepos = usage.repositories.length > 0;

      setState((prev) => ({ ...prev, isSetup: hasRepos }));
      return hasRepos;
    } catch (error) {
      console.error('Failed to check setup status:', error);
      return false;
    }
  }, []);

  // Set current repository
  const setRepository = useCallback(
    async (
      source: 'github' | 'uploaded',
      identifier: string,
      displayName: string
    ): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // For curated GitHub repos, they're already available at build time
        let isCurated = false;
        if (source === 'github') {
          const { owner, repo } = parseGitHubRepoIdentifier(identifier);
          isCurated = isCuratedRepo(owner, repo);
        }

        // Check if repository exists (for non-curated repos, check IndexedDB)
        if (!isCurated) {
          console.log('[Repository Context] Checking if repository exists:', {
            source,
            identifier,
            displayName,
          });
          const exists = await repositoryExists(source, identifier);
          console.log('[Repository Context] Repository exists check result:', {
            source,
            identifier,
            displayName,
            exists,
          });
          if (!exists) {
            console.error('[Repository Context] Repository not found in local storage:', {
              source,
              identifier,
              displayName,
            });
            throw new Error(`Repository ${displayName} not found in local storage`);
          }
        }

        // Get available branches
        // For curated repos, use trusted branch directly
        let branches: string[] = [];
        if (isCurated && source === 'github') {
          const { owner, repo } = parseGitHubRepoIdentifier(identifier);
          const trustedVersion = getTrustedVersion(owner, repo);
          branches = trustedVersion ? [trustedVersion] : [];
        } else {
          branches = await getAvailableBranches(source, identifier);
        }

        // Filter out main/master branches - they are unstable
        if (source === 'github') {
          branches = filterUnstableBranches(branches);
        }

        if (branches.length === 0) {
          throw new Error(`No stable branches found for repository ${displayName}`);
        }

        // Get trusted branches for GitHub repos
        let trustedBranches: string[] = [];
        if (source === 'github') {
          const { owner, repo } = parseGitHubRepoIdentifier(identifier);
          const trustedVersion = getTrustedVersion(owner, repo);
          trustedBranches = trustedVersion ? [trustedVersion] : [];
        }

        // Set default branch (first trusted branch if available, otherwise first available stable branch)
        const defaultBranch =
          source === 'github' && trustedBranches.length > 0
            ? trustedBranches.find((branch) => branches.includes(branch)) || branches[0]
            : branches[0];

        // For curated repos, mark branch as available immediately
        const downloadStatus: Record<string, BranchDownloadStatus> = {};
        if (isCurated && defaultBranch) {
          downloadStatus[defaultBranch] = {
            isDownloading: false,
            isAvailable: true,
          };
        }

        setState((prev) => ({
          ...prev,
          source,
          identifier,
          displayName,
          currentBranch: defaultBranch,
          availableBranches: branches,
          trustedBranches,
          downloadStatus,
          isLoading: false,
          isSetup: true,
          error: null,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to set repository';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    []
  );

  // Clear current repository
  const clearRepository = useCallback(() => {
    setState({
      source: null,
      identifier: null,
      displayName: null,
      currentBranch: null,
      availableBranches: [],
      trustedBranches: [],
      isLoading: false,
      isSetup: false,
      error: null,
      downloadStatus: {},
      downloadProgress: null,
    });
  }, []);

  // Download branch if needed (GitHub repos only)
  const downloadBranchIfNeeded = useCallback(
    async (branch: string): Promise<void> => {
      if (state.source !== 'github' || !state.identifier) {
        return;
      }

      const { owner, repo } = parseGitHubRepoIdentifier(state.identifier);

      // Check if this is a curated repo (already downloaded at build time)
      if (isCuratedRepo(owner, repo)) {
        // Curated repos are already available, mark as available
        setState((prev) => ({
          ...prev,
          downloadStatus: {
            ...prev.downloadStatus,
            [branch]: { isDownloading: false, isAvailable: true },
          },
        }));
        return;
      }

      // For non-curated repos, check download status
      const status = await getBranchDownloadStatus(owner, repo, branch);

      if (status.isAvailable || status.isDownloading) {
        return; // Already available or downloading
      }

      // Start download with progress tracking
      setState((prev) => ({
        ...prev,
        downloadStatus: {
          ...prev.downloadStatus,
          [branch]: { isDownloading: true, isAvailable: false },
        },
      }));

      try {
        await downloadBranch(owner, repo, branch, (progress) => {
          setState((prev) => ({ ...prev, downloadProgress: progress }));
        });

        // Update status
        setState((prev) => ({
          ...prev,
          downloadStatus: {
            ...prev.downloadStatus,
            [branch]: { isDownloading: false, isAvailable: true },
          },
          downloadProgress: null,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Download failed';

        setState((prev) => ({
          ...prev,
          downloadStatus: {
            ...prev.downloadStatus,
            [branch]: {
              isDownloading: false,
              isAvailable: false,
              error: errorMessage,
            },
          },
          downloadProgress: null,
        }));

        throw error;
      }
    },
    [state.source, state.identifier]
  );

  // Switch to different branch
  const switchBranch = useCallback(
    async (branch: string): Promise<void> => {
      if (!state.source || !state.identifier) {
        throw new Error('No repository selected');
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // For GitHub repos, check if branch needs to be downloaded
        if (state.source === 'github') {
          await downloadBranchIfNeeded(branch);
        }

        // Refresh available branches (in case new branch was downloaded)
        const branches = await getAvailableBranches(state.source, state.identifier);

        if (!branches.includes(branch)) {
          throw new Error(`Branch ${branch} not available`);
        }

        setState((prev) => ({
          ...prev,
          currentBranch: branch,
          availableBranches: branches,
          isLoading: false,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to switch branch';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [state.source, state.identifier, downloadBranchIfNeeded]
  );

  // Refresh available branches
  const refreshBranches = useCallback(async (): Promise<void> => {
    if (!state.source || !state.identifier) {
      return;
    }

    try {
      const branches = await getAvailableBranches(state.source, state.identifier);
      setState((prev) => ({ ...prev, availableBranches: branches }));
    } catch (error) {
      console.error('Failed to refresh branches:', error);
    }
  }, [state.source, state.identifier]);

  // Get repository info
  const getRepoInfo = useCallback(() => {
    if (!state.source || !state.identifier) {
      return null;
    }

    if (state.source === 'github') {
      const { owner, repo } = parseGitHubRepoIdentifier(state.identifier);
      return { owner, repo };
    } else {
      return { repoId: state.identifier };
    }
  }, [state.source, state.identifier]);

  // Initialize setup status on mount
  useEffect(() => {
    checkSetupStatus();
  }, [checkSetupStatus]);

  const contextValue: RepositoryContextValue = {
    ...state,
    setRepository,
    clearRepository,
    checkSetupStatus,
    switchBranch,
    refreshBranches,
    downloadBranchIfNeeded,
    getRepoInfo,
  };

  return <RepositoryContext.Provider value={contextValue}>{children}</RepositoryContext.Provider>;
}

// Hook to use repository context
export function useRepository(): RepositoryContextValue {
  const context = useContext(RepositoryContext);

  if (!context) {
    throw new Error('useRepository must be used within a RepositoryProvider');
  }

  return context;
}

// Hook to check if repository is set up (for redirects)
export function useRepositorySetup(): {
  isSetup: boolean;
  isLoading: boolean;
  checkSetup: () => Promise<boolean>;
} {
  const { isSetup, isLoading, checkSetupStatus } = useRepository();

  return {
    isSetup,
    isLoading,
    checkSetup: checkSetupStatus,
  };
}

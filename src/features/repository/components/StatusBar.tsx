'use client';

import React from 'react';
import BugReportWidget from '@/components/BugReportWidget';
import type { CuratedRepoSourceMode } from '@/lib/repo-static';

type WorkspaceTheme = 'dark' | 'light';

interface StatusBarProps {
  repoLabel?: string;
  branch?: string;
  sourceMode?: CuratedRepoSourceMode;
  canUseR2Source?: boolean;
  onSourceModeChange?: (sourceMode: CuratedRepoSourceMode) => void;
  workspaceTheme?: WorkspaceTheme;
  onWorkspaceThemeChange?: (theme: WorkspaceTheme) => void;
}

function formatDisplayBranch(branch: string): string {
  if (!/^[0-9a-f]{7,40}$/i.test(branch)) {
    return branch;
  }

  return branch.length > 12 ? `${branch.slice(0, 12)}…` : branch;
}

function buildGitHubTreeUrl(repoLabel: string, branch: string): string {
  return `https://github.com/${repoLabel}/tree/${branch
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

const StatusBar: React.FC<StatusBarProps> = ({
  repoLabel,
  branch,
  sourceMode,
  canUseR2Source = false,
  onSourceModeChange,
  workspaceTheme,
  onWorkspaceThemeChange,
}) => {
  const branchLabel = branch ? formatDisplayBranch(branch) : null;
  const githubRepoUrl = repoLabel ? `https://github.com/${repoLabel}` : null;
  const githubTreeUrl = repoLabel && branch ? buildGitHubTreeUrl(repoLabel, branch) : null;
  const sourceLabel =
    sourceMode === 'local-filesystem'
      ? 'Local staged corpus'
      : sourceMode === 'r2-bucket'
        ? 'R2'
        : null;

  return (
    <div className="cursor-statusbar">
      <div className="cursor-statusbar-left">
        {repoLabel && (
          <>
            <a
              className="cursor-statusbar-item cursor-statusbar-link"
              href={githubRepoUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open repository: ${repoLabel}`}
              aria-label={`Open repository ${repoLabel}`}
            >
              <span className="cursor-statusbar-icon">🔗</span>
              <span className="cursor-statusbar-text">{repoLabel}</span>
            </a>
            <div className="cursor-statusbar-divider" />
          </>
        )}
        {branch && branchLabel && (
          <>
            <a
              className="cursor-statusbar-item cursor-statusbar-link"
              href={githubTreeUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open branch/revision: ${branch}`}
              aria-label={`Open branch or revision ${branch}`}
            >
              <span className="cursor-statusbar-icon">🌿</span>
              <span className="cursor-statusbar-text">{branchLabel}</span>
            </a>
            <div className="cursor-statusbar-divider" />
          </>
        )}
      </div>
      <div className="cursor-statusbar-right">
        {sourceMode && sourceLabel && onSourceModeChange && (
          <label
            className="cursor-statusbar-item cursor-statusbar-source"
            title={`Storage source: ${sourceLabel}`}
          >
            <span className="cursor-statusbar-icon">🌐</span>
            <span className="cursor-statusbar-text">storage</span>
            <select
              value={sourceMode}
              onChange={(event) => onSourceModeChange(event.target.value as CuratedRepoSourceMode)}
              aria-label="Storage source"
            >
              <option value="local-filesystem">local</option>
              <option value="r2-bucket" disabled={!canUseR2Source}>
                R2
              </option>
            </select>
          </label>
        )}
        {workspaceTheme && onWorkspaceThemeChange && (
          <button
            type="button"
            className="cursor-statusbar-item cursor-statusbar-button"
            onClick={() => onWorkspaceThemeChange(workspaceTheme === 'light' ? 'dark' : 'light')}
            title={workspaceTheme === 'light' ? 'Use dark theme' : 'Use light theme'}
            aria-label={workspaceTheme === 'light' ? 'Use dark theme' : 'Use light theme'}
            aria-pressed={workspaceTheme === 'light'}
          >
            <span className="cursor-statusbar-icon" aria-hidden="true">
              {workspaceTheme === 'light' ? '🌙' : '☀️'}
            </span>
            <span className="cursor-statusbar-text">
              {workspaceTheme === 'light' ? 'dark' : 'light'}
            </span>
          </button>
        )}
        <BugReportWidget variant="statusbar" />
      </div>
    </div>
  );
};

export default StatusBar;

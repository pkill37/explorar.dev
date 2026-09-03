'use client';

import React, { useEffect, useState } from 'react';
import BugReportWidget from '@/components/BugReportWidget';
import { getCuratedRepoAccent } from '@/lib/curated-repos';
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
  const [repoSwitchFlash, setRepoSwitchFlash] = useState(false);
  const branchLabel = branch ? formatDisplayBranch(branch) : null;
  const githubRepoUrl = repoLabel ? `https://github.com/${repoLabel}` : null;
  const githubTreeUrl = repoLabel && branch ? buildGitHubTreeUrl(repoLabel, branch) : null;
  const [repoOwner, repoName] = repoLabel?.split('/') ?? [];
  const repoAccent = repoOwner && repoName ? getCuratedRepoAccent(repoOwner, repoName) : undefined;
  const sourceLabel =
    sourceMode === 'local-filesystem'
      ? 'Local staged corpus'
      : sourceMode === 'r2-bucket'
        ? 'R2'
        : null;

  useEffect(() => {
    if (!repoLabel || typeof window === 'undefined') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      try {
        const stored = sessionStorage.getItem('explorar:repo-switch-flash');
        if (!stored) {
          setRepoSwitchFlash(false);
          return;
        }

        const parsed = JSON.parse(stored) as { to?: string; ts?: number };
        setRepoSwitchFlash(parsed.to === repoLabel);
      } catch {
        setRepoSwitchFlash(false);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [repoLabel]);

  useEffect(() => {
    if (!repoLabel || typeof window === 'undefined' || !repoSwitchFlash) {
      return;
    }

    try {
      sessionStorage.removeItem('explorar:repo-switch-flash');
    } catch {
      // Ignore storage failures; the visual cue is still time-boxed below.
    }

    const timeoutId = window.setTimeout(() => setRepoSwitchFlash(false), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [repoLabel, repoSwitchFlash]);

  return (
    <div
      className="cursor-statusbar"
      style={repoAccent ? ({ '--repo-accent': repoAccent } as React.CSSProperties) : undefined}
    >
      <div className="cursor-statusbar-left">
        {repoLabel && (
          <>
            <a
              className={`cursor-statusbar-item cursor-statusbar-link${
                repoSwitchFlash ? ' cursor-statusbar-link--repo-flash' : ''
              } cursor-statusbar-repo`}
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

'use client';

import React from 'react';
import type { CuratedRepoSourceMode } from '@/lib/repo-static';

interface StatusBarProps {
  repoLabel?: string;
  branch?: string;
  sourceMode?: CuratedRepoSourceMode;
  canUseR2Source?: boolean;
  onSourceModeChange?: (sourceMode: CuratedRepoSourceMode) => void;
}

function formatDisplayBranch(branch: string): string {
  if (!/^[0-9a-f]{7,40}$/i.test(branch)) {
    return branch;
  }

  return branch.length > 12 ? `${branch.slice(0, 12)}…` : branch;
}

const StatusBar: React.FC<StatusBarProps> = ({
  repoLabel,
  branch,
  sourceMode,
  canUseR2Source = false,
  onSourceModeChange,
}) => {
  const branchLabel = branch ? formatDisplayBranch(branch) : null;
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
            <div className="cursor-statusbar-item" title={`Repository: ${repoLabel}`}>
              <span className="cursor-statusbar-icon">🔗</span>
              <span className="cursor-statusbar-text">{repoLabel}</span>
            </div>
            <div className="cursor-statusbar-divider" />
          </>
        )}
        {branch && branchLabel && (
          <>
            <div className="cursor-statusbar-item" title={`Branch: ${branch}`}>
              <span className="cursor-statusbar-icon">🌿</span>
              <span className="cursor-statusbar-text">{branchLabel}</span>
            </div>
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
      </div>
    </div>
  );
};

export default StatusBar;

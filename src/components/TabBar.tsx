'use client';

import React from 'react';
import { EditorTab } from '@/types';
import {
  getFileSourceModeLabel,
  setFileSourceMode,
  type FileSourceMode,
} from '@/lib/curated-content-url';

interface TabBarProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  fileSourceMode: FileSourceMode;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, onTabSelect, onTabClose, fileSourceMode }) => {
  const getFileIcon = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'c':
        return '⚙️';
      case 'h':
        return '🔧';
      case 's':
      case 'S':
        return '🔩';
      case 'py':
        return '🐍';
      case 'sh':
        return '🐚';
      case 'md':
        return '📖';
      case 'json':
        return '📋';
      default:
        return '📄';
    }
  };

  const getFileName = (path: string): string => {
    return path.split('/').pop() || path;
  };

  const handleTabClick = (tab: EditorTab, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (tab.isLoading) return;

    onTabSelect(tab.id);
  };

  const handleTabClose = (tabId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onTabClose(tabId);
  };

  const handleTabMiddleClick = (tab: EditorTab, event: React.MouseEvent) => {
    if (event.button === 1) {
      // Middle mouse button
      event.preventDefault();
      event.stopPropagation();
      onTabClose(tab.id);
    }
  };

  const handleSourceModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (typeof window === 'undefined') {
      return;
    }

    setFileSourceMode(event.target.value as FileSourceMode);
    window.location.reload();
  };

  return (
    <div className="vscode-tab-bar">
      <div className="vscode-tab-strip">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`vscode-tab ${tab.isActive ? 'active' : ''}`}
            onClick={(e) => handleTabClick(tab, e)}
            onMouseDown={(e) => handleTabMiddleClick(tab, e)}
            title={tab.path}
          >
            <span className="icon">
              {tab.isLoading ? (
                <div className="vscode-spinner" style={{ width: '10px', height: '10px' }} />
              ) : (
                getFileIcon(tab.path)
              )}
            </span>

            <span className="name">{getFileName(tab.title || tab.path)}</span>

            {tab.isDirty && (
              <span style={{ color: '#dcdcaa', fontSize: '12px', marginLeft: '4px' }}>•</span>
            )}

            <div
              className="close"
              onClick={(e) => handleTabClose(tab.id, e)}
              title={`Close ${getFileName(tab.path)}`}
            >
              ✕
            </div>
          </div>
        ))}
      </div>

      <div className="vscode-tab-actions">
        <label
          className="vscode-source-select-wrap"
          title={`Current source: ${getFileSourceModeLabel(fileSourceMode)}`}
        >
          <span className="vscode-source-select-label">Source</span>
          <select
            className="vscode-source-select"
            value={fileSourceMode}
            onChange={handleSourceModeChange}
          >
            <option value="local-filesystem">Local filesystem</option>
            <option value="github-api">api.github.com</option>
            <option value="r2-bucket">R2 bucket</option>
          </select>
        </label>
      </div>
    </div>
  );
};

export default TabBar;

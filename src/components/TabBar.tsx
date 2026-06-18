'use client';

import React from 'react';
import { EditorTab } from '@/types';

interface TabBarProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onMarkdownPreviewToggle?: () => void;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onMarkdownPreviewToggle,
}) => {
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
      case 'rst':
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

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || null;
  const isMarkdownTab = !!activeTab && /\.(md|rst)$/i.test(activeTab.path);
  const isPreviewMode = activeTab?.viewMode === 'preview';

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
      {isMarkdownTab && onMarkdownPreviewToggle && (
        <button
          type="button"
          onClick={onMarkdownPreviewToggle}
          title={isPreviewMode ? 'Show source' : 'Open preview'}
          aria-label={isPreviewMode ? 'Show source' : 'Open preview'}
          style={{
            marginLeft: 'auto',
            marginRight: '8px',
            alignSelf: 'center',
            border: '1px solid var(--vscode-border)',
            background: isPreviewMode
              ? 'var(--vscode-text-accent, #0078d4)'
              : 'var(--vscode-editor-background, #1e1e1e)',
            color: isPreviewMode
              ? 'var(--vscode-button-foreground, #fff)'
              : 'var(--vscode-foreground, #d4d4d4)',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {isPreviewMode ? 'Source' : 'Preview'}
        </button>
      )}
    </div>
  );
};

export default TabBar;

'use client';

import React from 'react';

interface StatusBarProps {
  filePath?: string;
  line?: number;
  column?: number;
  language?: string;
  lineCount?: number;
  fileSize?: string;
  repoLabel?: string;
}

const StatusBar: React.FC<StatusBarProps> = ({
  filePath,
  line = 1,
  column = 1,
  language,
  lineCount,
  fileSize,
  repoLabel
}) => {
  return (
    <div className="cursor-statusbar">
      <div className="cursor-statusbar-left">
        {filePath && (
          <>
            <div className="cursor-statusbar-item" title={filePath}>
              <span className="cursor-statusbar-icon">📄</span>
              <span className="cursor-statusbar-text">{filePath.split('/').pop() || filePath}</span>
            </div>
            <div className="cursor-statusbar-divider" />
          </>
        )}
        {language && (
          <>
            <div className="cursor-statusbar-item">
              <span className="cursor-statusbar-text">{language.toUpperCase()}</span>
            </div>
            <div className="cursor-statusbar-divider" />
          </>
        )}
        <div className="cursor-statusbar-item">
          <span className="cursor-statusbar-text">
            {line}:{column}
          </span>
        </div>
        {lineCount && (
          <>
            <div className="cursor-statusbar-divider" />
            <div className="cursor-statusbar-item">
              <span className="cursor-statusbar-text">{lineCount} lines</span>
            </div>
          </>
        )}
        {fileSize && (
          <>
            <div className="cursor-statusbar-divider" />
            <div className="cursor-statusbar-item">
              <span className="cursor-statusbar-text">{fileSize}</span>
            </div>
          </>
        )}
      </div>
      <div className="cursor-statusbar-right">
        {repoLabel && (
          <>
            <div className="cursor-statusbar-item" title={repoLabel}>
              <span className="cursor-statusbar-icon">🔗</span>
              <span className="cursor-statusbar-text">{repoLabel}</span>
            </div>
            <div className="cursor-statusbar-divider" />
          </>
        )}
        <div className="cursor-statusbar-item">
          <span className="cursor-statusbar-text">UTF-8</span>
        </div>
        <div className="cursor-statusbar-divider" />
        <div className="cursor-statusbar-item">
          <span className="cursor-statusbar-text">LF</span>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;


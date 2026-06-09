'use client';

import React from 'react';
import { type FileFetchDebugInfo } from '@/lib/file-fetch-debug';

interface StatusBarProps {
  filePath?: string;
  line?: number;
  column?: number;
  language?: string;
  lineCount?: number;
  fileSize?: string;
  repoLabel?: string;
  branch?: string;
  fileFetchDebugInfo?: FileFetchDebugInfo | null;
}

function formatDebugLabel(debugInfo: FileFetchDebugInfo): string {
  const source =
    debugInfo.source === 'r2-bucket'
      ? '🛰 R2'
      : debugInfo.source === 'local-filesystem'
        ? '💾 LOCAL'
        : '🌐 GITHUB';
  const cacheStatus = debugInfo.cacheStatus ? ` ${debugInfo.cacheStatus}` : '';
  return `${source}${cacheStatus}`;
}

function formatDebugTitle(debugInfo: FileFetchDebugInfo): string {
  const details = [
    `Source: ${debugInfo.source}`,
    `Status: ${debugInfo.responseStatus ?? 'unknown'}`,
    `Request URL: ${debugInfo.requestUrl}`,
  ];

  if (debugInfo.responseUrl) {
    details.push(`Response URL: ${debugInfo.responseUrl}`);
  }
  if (debugInfo.cacheStatus) {
    details.push(`CF Cache: ${debugInfo.cacheStatus}`);
  }
  if (debugInfo.r2Key) {
    details.push(`R2 Key: ${debugInfo.r2Key}`);
  }
  if (debugInfo.contentLength) {
    details.push(`Content-Length: ${debugInfo.contentLength}`);
  }

  return details.join('\n');
}

const StatusBar: React.FC<StatusBarProps> = ({
  filePath,
  line = 1,
  column = 1,
  language,
  lineCount,
  fileSize,
  repoLabel,
  branch,
  fileFetchDebugInfo,
}) => {
  return (
    <div className="cursor-statusbar">
      <div className="cursor-statusbar-left">
        {branch && (
          <>
            <div className="cursor-statusbar-item" title={`Branch: ${branch}`}>
              <span className="cursor-statusbar-icon">🌿</span>
              <span className="cursor-statusbar-text">{branch}</span>
            </div>
            <div className="cursor-statusbar-divider" />
          </>
        )}
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
        {fileFetchDebugInfo?.enabled && (
          <>
            <div className="cursor-statusbar-item" title={formatDebugTitle(fileFetchDebugInfo)}>
              <span className="cursor-statusbar-text">{formatDebugLabel(fileFetchDebugInfo)}</span>
            </div>
            <div className="cursor-statusbar-divider" />
          </>
        )}
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

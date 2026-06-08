'use client';

import React, { useState, useEffect, useRef } from 'react';
import MonacoCodeEditor from './MonacoCodeEditor';
import { fetchFileContent as fetchFromGitHub, GitHubApiError } from '@/lib/github-api';
import { useGitHubRateLimit } from '@/contexts/GitHubRateLimitContext';
import type { FileFetchDebugInfo, FileFetchResult } from '@/lib/file-fetch-debug';

interface CodeEditorContainerProps {
  filePath: string;
  onContentLoad?: (content: string) => void;
  fetchFile?: (path: string) => Promise<FileFetchResult>;
  onFetchDebugInfo?: (filePath: string, debugInfo: FileFetchDebugInfo | null) => void;
  scrollToLine?: number;
  searchPattern?: string;
  onCursorChange?: (line: number, column: number) => void;
}

const CodeEditorContainer: React.FC<CodeEditorContainerProps> = ({
  filePath,
  onContentLoad,
  fetchFile,
  onFetchDebugInfo,
  scrollToLine,
  searchPattern,
  onCursorChange,
}) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string>('');
  // Use ref to cache loaded files without causing re-renders
  const loadedFilesCache = useRef<Map<string, FileFetchResult>>(new Map());
  const { setRateLimit } = useGitHubRateLimit();

  useEffect(() => {
    const loadFileContent = async () => {
      if (!filePath) {
        setContent('');
        setError(null);
        setCurrentFilePath('');
        onFetchDebugInfo?.('', null);
        return;
      }

      // Don't reload if it's the same file
      if (filePath === currentFilePath) {
        return;
      }

      // Check if file is already loaded in cache (lazy load optimization)
      if (loadedFilesCache.current.has(filePath)) {
        const cachedResult = loadedFilesCache.current.get(filePath);
        const cachedContent = cachedResult?.content || '';
        setContent(cachedContent);
        setCurrentFilePath(filePath);
        setError(null);
        onFetchDebugInfo?.(filePath, cachedResult?.debugInfo ?? null);
        // Notify parent of cached content
        if (onContentLoad) {
          onContentLoad(cachedContent);
        }
        return;
      }

      // Lazy load: Only load file content when filePath is set (file is explicitly opened)
      setError(null);
      setIsLoading(true);
      setCurrentFilePath(filePath);

      try {
        const fileResult = await (fetchFile ? fetchFile(filePath) : fetchFromGitHub(filePath));
        setContent(fileResult.content);

        // Cache the loaded content for future use
        loadedFilesCache.current.set(filePath, fileResult);
        onFetchDebugInfo?.(filePath, fileResult.debugInfo ?? null);

        // Notify parent component of content load
        if (onContentLoad) {
          onContentLoad(fileResult.content);
        }
      } catch (err) {
        // Check if it's a rate limit error
        if (err instanceof GitHubApiError && err.status === 403) {
          setRateLimit(err);
        }
        const errorMessage = err instanceof Error ? err.message : 'Failed to load file';
        setError(errorMessage);
        setContent(''); // Clear content on error
        onFetchDebugInfo?.(filePath, null);
        console.error('Failed to load file content:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadFileContent();
  }, [filePath, fetchFile, currentFilePath, onContentLoad, onFetchDebugInfo, setRateLimit]);

  if (error) {
    return (
      <div className="vscode-editor">
        <div className="vscode-loading">
          <div>⚠️ Failed to load file</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>{error}</div>
          <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>File: {filePath}</div>
        </div>
      </div>
    );
  }

  return (
    <MonacoCodeEditor
      filePath={filePath}
      content={content}
      isLoading={isLoading}
      scrollToLine={scrollToLine}
      searchPattern={searchPattern}
      onCursorChange={onCursorChange}
    />
  );
};

export default CodeEditorContainer;

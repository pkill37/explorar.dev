'use client';

import React, { useState, useEffect } from 'react';
import MonacoCodeEditor from './MonacoCodeEditor';
import KernelStudyEditor from './KernelStudyEditor';
import { fetchFileContent as fetchFromGitHub } from '@/lib/github-api';

interface CodeEditorContainerProps {
  filePath: string;
  onContentLoad?: (content: string) => void;
  fetchFile?: (path: string) => Promise<string>;
  repoLabel?: string;
  scrollToLine?: number;
  searchPattern?: string;
  onCursorChange?: (line: number, column: number) => void;
}

const CodeEditorContainer: React.FC<CodeEditorContainerProps> = ({
  filePath,
  onContentLoad,
  fetchFile,
  repoLabel,
  scrollToLine,
  searchPattern,
  onCursorChange,
}) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string>('');

  useEffect(() => {
    const loadFileContent = async () => {
      if (!filePath) {
        setContent('');
        setError(null);
        setCurrentFilePath('');
        return;
      }

      // Don't reload if it's the same file
      if (filePath === currentFilePath) return;

      setError(null);
      setIsLoading(true);
      setCurrentFilePath(filePath);

      try {
        const fileContent = await (fetchFile ? fetchFile(filePath) : fetchFromGitHub(filePath));
        setContent(fileContent);

        // Notify parent component of content load
        if (onContentLoad) {
          onContentLoad(fileContent);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load file';
        setError(errorMessage);
        setContent(''); // Clear content on error
        console.error('Failed to load file content:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadFileContent();
  }, [filePath, fetchFile, currentFilePath, onContentLoad]);

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

  // Determine if this is a kernel file that would benefit from study annotations
  const isKernelFile = (path: string): boolean => {
    return (
      path.includes('kernel/') ||
      path.includes('arch/') ||
      path.includes('include/linux/') ||
      path.includes('mm/') ||
      path.includes('fs/') ||
      path.includes('drivers/') ||
      path.includes('init/') ||
      path.endsWith('.c') ||
      path.endsWith('.h') ||
      path.endsWith('.S')
    );
  };

  const useKernelStudyEditor = isKernelFile(filePath);

  return useKernelStudyEditor ? (
    <KernelStudyEditor
      filePath={filePath}
      content={content}
      isLoading={isLoading}
      repoLabel={repoLabel}
      scrollToLine={scrollToLine}
      searchPattern={searchPattern}
      onCursorChange={onCursorChange}
    />
  ) : (
    <MonacoCodeEditor
      filePath={filePath}
      content={content}
      isLoading={isLoading}
      repoLabel={repoLabel}
      scrollToLine={scrollToLine}
      searchPattern={searchPattern}
      onCursorChange={onCursorChange}
    />
  );
};

export default CodeEditorContainer;

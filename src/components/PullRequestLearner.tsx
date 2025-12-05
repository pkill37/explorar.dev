'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchPullRequest,
  fetchPullRequestFiles,
  fetchPullRequestDiff,
  fetchFileContent,
  setGitHubRepo,
} from '@/lib/github-api';
import type { PullRequest, PullRequestFile, PullRequestDiff } from '@/types';
import GuidePanel from './GuidePanel';
import CodeEditorContainer from './CodeEditorContainer';
import { createPRGuide } from '@/lib/guides/pr-guide';
import '@/app/linux-kernel-explorer/vscode.css';

interface PullRequestLearnerProps {
  owner: string;
  repo: string;
  prNumber: number;
}

export default function PullRequestLearner({ owner, repo, prNumber }: PullRequestLearnerProps) {
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [files, setFiles] = useState<PullRequestFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<Map<string, PullRequestDiff>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDiffs, setIsLoadingDiffs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  // Cache for preloaded file contents
  const fileContentsCache = useRef<Map<string, string>>(new Map());

  // Mobile view state: 'guide' | 'diff' | 'code'
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<'guide' | 'diff' | 'code'>('diff');

  // Generate PR guide sections
  const guideSections = useMemo(() => {
    if (!pr || files.length === 0) return [];
    return createPRGuide(pr, files, diffs, (filename) => {
      setSelectedFile(filename);
      if (isMobile) {
        setMobileView('code');
      }
    });
  }, [pr, files, diffs, isMobile]);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkViewport = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 1024);
      }
    };
    checkViewport();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkViewport);
      return () => window.removeEventListener('resize', checkViewport);
    }
  }, []);

  // Set the repo context
  useEffect(() => {
    if (pr) {
      setGitHubRepo(owner, repo, pr.base.ref);
    }
  }, [owner, repo, pr]);

  // Fetch PR data and preload all diffs and file contents
  useEffect(() => {
    const loadPR = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [prData, filesData] = await Promise.all([
          fetchPullRequest(owner, repo, prNumber),
          fetchPullRequestFiles(owner, repo, prNumber),
        ]);

        setPr(prData);
        setFiles(filesData);

        // Auto-select first file if available
        if (filesData.length > 0) {
          setSelectedFile(filesData[0].filename);
        }

        // Preload all diffs and file contents
        setIsLoadingDiffs(true);
        const diffsMap = new Map<string, PullRequestDiff>();
        const loadPromises: Promise<void>[] = [];

        for (const file of filesData) {
          // Skip deleted files (they don't have content to load)
          if (file.status === 'removed') {
            continue;
          }

          // Load diff for each file
          loadPromises.push(
            fetchPullRequestDiff(owner, repo, prNumber, file.filename)
              .then((diff) => {
                if (diff) {
                  diffsMap.set(file.filename, diff);
                }
              })
              .catch((err) => {
                console.error(`Failed to load diff for ${file.filename}:`, err);
              })
          );

          // Preload file content (for context editor)
          loadPromises.push(
            fetchFileContent(file.filename)
              .then((content) => {
                fileContentsCache.current.set(file.filename, content);
              })
              .catch((err) => {
                console.error(`Failed to preload content for ${file.filename}:`, err);
              })
          );
        }

        // Load all diffs and files in parallel (with some batching to avoid overwhelming)
        await Promise.all(loadPromises);
        setDiffs(diffsMap);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load pull request');
        }
        console.error('Failed to load PR:', err);
      } finally {
        setIsLoading(false);
        setIsLoadingDiffs(false);
      }
    };

    loadPR();
  }, [owner, repo, prNumber]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontSize: '14px',
        }}
      >
        Loading pull request...
      </div>
    );
  }

  if (error || !pr) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '16px',
        }}
      >
        <div style={{ fontSize: '16px', color: 'var(--vscode-errorForeground)' }}>
          {error || 'Failed to load pull request'}
        </div>
        <button
          onClick={() => router.push('/')}
          style={{
            padding: '8px 16px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  // Common panel styles
  const panelBaseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '100%',
    maxHeight: '100%',
    background: 'var(--vscode-editor-background)',
  };

  const mobilePanelStyle: React.CSSProperties = isMobile
    ? {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: '56px',
        zIndex: 100,
        width: '100%',
      }
    : {};

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: isMobile ? '56px' : '0',
      }}
    >
      {/* Left Panel - PR Guide */}
      <div
        style={{
          ...panelBaseStyle,
          ...mobilePanelStyle,
          width: isMobile ? '100%' : '400px',
          minWidth: isMobile ? '100%' : '300px',
          borderRight: isMobile ? 'none' : '1px solid var(--vscode-border)',
          display: isMobile && mobileView !== 'guide' ? 'none' : 'flex',
        }}
      >
        {isMobile && (
          <div
            style={{
              padding: '12px',
              borderBottom: '1px solid var(--vscode-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>PR Guide</h3>
            <button
              onClick={() => setMobileView('diff')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--vscode-text-primary)',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '18px',
              }}
              aria-label="Close guide"
            >
              ✕
            </button>
          </div>
        )}
        {guideSections.length > 0 && (
          <GuidePanel
            sections={guideSections}
            defaultOpenIds={['pr-overview', 'pr-summary']}
          />
        )}
      </div>

      {/* Middle Panel - Diff View */}
      <div
        style={{
          ...panelBaseStyle,
          ...mobilePanelStyle,
          flex: isMobile ? 'none' : '1 1 0%',
          minWidth: 0,
          width: isMobile ? '100%' : 'auto',
          display: isMobile && mobileView !== 'diff' ? 'none' : 'flex',
          borderRight: isMobile ? 'none' : '1px solid var(--vscode-border)',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--vscode-border)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
            All Changes ({files.length} file{files.length !== 1 ? 's' : ''})
          </div>
          {isLoadingDiffs && (
            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
              Loading diffs...
            </div>
          )}
        </div>
        <div
          style={{
            flex: '1 1 0%',
            overflow: 'auto',
            minHeight: 0,
            fontFamily: 'var(--vscode-editor-font-family)',
            fontSize: 'var(--vscode-editor-font-size)',
          }}
        >
          {isLoadingDiffs ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                opacity: 0.5,
              }}
            >
              Loading all diffs...
            </div>
          ) : files.length > 0 ? (
            <div style={{ padding: '0' }}>
              {files.map((file) => {
                const diff = diffs.get(file.filename);
                const isSelected = selectedFile === file.filename;

                return (
                  <div
                    key={file.filename}
                    style={{
                      borderBottom: '1px solid var(--vscode-border)',
                      background: isSelected
                        ? 'var(--vscode-list-activeSelectionBackground)'
                        : 'transparent',
                    }}
                  >
                    {/* File Header */}
                    <div
                      style={{
                        padding: '12px 16px',
                        background: 'var(--vscode-textCodeBlock-background)',
                        borderLeft: isSelected
                          ? '3px solid var(--vscode-textLink-foreground)'
                          : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onClick={() => {
                        setSelectedFile(file.filename);
                        // On mobile, switch to code view when file is selected
                        if (isMobile) {
                          setMobileView('code');
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background =
                            'var(--vscode-textCodeBlock-background)';
                        }
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            marginBottom: '4px',
                          }}
                        >
                          {file.filename}
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.7 }}>
                          {file.status === 'added' && '➕ Added'}
                          {file.status === 'removed' && '➖ Removed'}
                          {file.status === 'modified' && '✏️ Modified'}
                          {file.status === 'renamed' &&
                            `↪️ Renamed${file.previous_filename ? ` from ${file.previous_filename}` : ''}`}
                          {file.additions > 0 && (
                            <span
                              style={{
                                color: 'var(--vscode-testing-iconPassed)',
                                marginLeft: '8px',
                              }}
                            >
                              +{file.additions}
                            </span>
                          )}
                          {file.deletions > 0 && (
                            <span
                              style={{ color: 'var(--vscode-errorForeground)', marginLeft: '4px' }}
                            >
                              -{file.deletions}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* File Diff */}
                    {diff ? (
                      <div style={{ padding: '0' }}>
                        {diff.hunks.map((hunk, hunkIndex) => (
                          <div key={hunkIndex} style={{ marginBottom: '0' }}>
                            <div
                              style={{
                                padding: '8px 16px',
                                background: 'var(--vscode-textCodeBlock-background)',
                                borderLeft: '3px solid var(--vscode-textLink-foreground)',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                opacity: 0.8,
                              }}
                            >
                              {hunk.heading ||
                                `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`}
                            </div>
                            <div style={{ background: 'var(--vscode-textCodeBlock-background)' }}>
                              {hunk.lines.map((line, lineIndex) => {
                                const lineKey = `${file.filename}-${hunkIndex}-${lineIndex}`;
                                const bgColor =
                                  line.type === 'added'
                                    ? 'rgba(46, 160, 67, 0.15)'
                                    : line.type === 'removed'
                                      ? 'rgba(248, 81, 73, 0.15)'
                                      : 'transparent';
                                const borderColor =
                                  line.type === 'added'
                                    ? 'rgba(46, 160, 67, 0.3)'
                                    : line.type === 'removed'
                                      ? 'rgba(248, 81, 73, 0.3)'
                                      : 'transparent';

                                return (
                                  <div
                                    key={lineKey}
                                    style={{
                                      display: 'flex',
                                      borderLeft: `3px solid ${borderColor}`,
                                      background: bgColor,
                                      padding: '2px 8px',
                                      fontFamily: 'monospace',
                                      fontSize: '12px',
                                      lineHeight: '1.5',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: '70px',
                                        textAlign: 'right',
                                        paddingRight: '12px',
                                        opacity: 0.6,
                                        userSelect: 'none',
                                        borderRight: '1px solid var(--vscode-border)',
                                        marginRight: '12px',
                                        fontSize: '11px',
                                      }}
                                    >
                                      {line.oldLineNumber !== null ? line.oldLineNumber : ''}
                                    </div>
                                    <div
                                      style={{
                                        width: '70px',
                                        textAlign: 'right',
                                        paddingRight: '12px',
                                        opacity: 0.6,
                                        userSelect: 'none',
                                        borderRight: '1px solid var(--vscode-border)',
                                        marginRight: '12px',
                                        fontSize: '11px',
                                      }}
                                    >
                                      {line.newLineNumber !== null ? line.newLineNumber : ''}
                                    </div>
                                    <div
                                      style={{
                                        flex: 1,
                                        color:
                                          line.type === 'added'
                                            ? 'var(--vscode-testing-iconPassed)'
                                            : line.type === 'removed'
                                              ? 'var(--vscode-errorForeground)'
                                              : 'var(--vscode-foreground)',
                                        overflowX: 'auto',
                                      }}
                                    >
                                      <span style={{ opacity: 0.7, marginRight: '4px' }}>
                                        {line.type === 'added'
                                          ? '+'
                                          : line.type === 'removed'
                                            ? '-'
                                            : ' '}
                                      </span>
                                      {line.content}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : file.status === 'removed' ? (
                      <div
                        style={{
                          padding: '16px',
                          textAlign: 'center',
                          opacity: 0.6,
                          fontSize: '12px',
                        }}
                      >
                        File was removed
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '16px',
                          textAlign: 'center',
                          opacity: 0.6,
                          fontSize: '12px',
                        }}
                      >
                        Loading diff...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                opacity: 0.5,
              }}
            >
              No files changed
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Code Editor */}
      <div
        style={{
          ...panelBaseStyle,
          ...mobilePanelStyle,
          width: isMobile ? '100%' : '500px',
          minWidth: isMobile ? '100%' : '300px',
          display: isMobile && mobileView !== 'code' ? 'none' : 'flex',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--vscode-border)',
            fontSize: '14px',
            fontWeight: 'bold',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>File Context</span>
          {isMobile && (
            <button
              onClick={() => setMobileView('diff')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--vscode-text-primary)',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '18px',
              }}
              aria-label="Close code editor"
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ flex: '1 1 0%', overflow: 'hidden', minHeight: 0 }}>
          {selectedFile ? (
            <CodeEditorContainer
              filePath={selectedFile}
              repoLabel={`${owner}/${repo}`}
              scrollToLine={
                diffs.has(selectedFile) && diffs.get(selectedFile)!.hunks.length > 0
                  ? diffs.get(selectedFile)!.hunks[0].newStart
                  : undefined
              }
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                opacity: 0.5,
              }}
            >
              Select a file to view its full content
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '56px',
            background: 'var(--vscode-bg-secondary)',
            borderTop: '1px solid var(--vscode-border)',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            zIndex: 1000,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <button
            onClick={() => setMobileView('guide')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color:
                mobileView === 'guide'
                  ? 'var(--vscode-text-accent)'
                  : 'var(--vscode-text-secondary)',
              cursor: 'pointer',
              padding: '8px',
              fontSize: '12px',
              transition: 'color 0.2s',
            }}
            aria-label="Guide"
          >
            <span style={{ fontSize: '20px' }}>📖</span>
            <span>Guide</span>
          </button>
          <button
            onClick={() => setMobileView('diff')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color:
                mobileView === 'diff'
                  ? 'var(--vscode-text-accent)'
                  : 'var(--vscode-text-secondary)',
              cursor: 'pointer',
              padding: '8px',
              fontSize: '12px',
              transition: 'color 0.2s',
            }}
            aria-label="Diff"
          >
            <span style={{ fontSize: '20px' }}>📊</span>
            <span>Diff</span>
          </button>
          <button
            onClick={() => setMobileView('code')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color:
                mobileView === 'code'
                  ? 'var(--vscode-text-accent)'
                  : 'var(--vscode-text-secondary)',
              cursor: 'pointer',
              padding: '8px',
              fontSize: '12px',
              transition: 'color 0.2s',
            }}
            aria-label="Code"
          >
            <span style={{ fontSize: '20px' }}>📝</span>
            <span>Code</span>
          </button>
        </div>
      )}
    </div>
  );
}

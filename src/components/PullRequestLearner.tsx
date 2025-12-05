'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchPullRequest,
  fetchPullRequestFiles,
  fetchPullRequestDiff,
  fetchFileContent,
  setGitHubRepo,
} from '@/lib/github-api';
import type { PullRequest, PullRequestFile, PullRequestDiff } from '@/types';
import PRLearningChat from './PRLearningChat';
import CodeEditorContainer from './CodeEditorContainer';

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
      }}
    >
      {/* Left Panel - Learning Chat */}
      <div
        style={{
          width: '400px',
          minWidth: '300px',
          borderRight: '1px solid var(--vscode-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          height: '100%',
        }}
      >
        {pr && <PRLearningChat pr={pr} files={files} selectedFile={selectedFile} diffs={diffs} />}
      </div>

      {/* Middle Panel - Diff View */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: '1px solid var(--vscode-border)',
          height: '100%',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--vscode-border)',
            background: 'var(--vscode-editor-background)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              All Changes ({files.length} file{files.length !== 1 ? 's' : ''})
            </div>
            {isLoadingDiffs && (
              <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                Loading diffs...
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: 'var(--vscode-editor-background)',
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
                      onClick={() => setSelectedFile(file.filename)}
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
          width: '500px',
          minWidth: '300px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          height: '100%',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--vscode-border)',
            background: 'var(--vscode-editor-background)',
            fontSize: '14px',
            fontWeight: 'bold',
            flexShrink: 0,
          }}
        >
          File Context
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {selectedFile ? (
            <div
              style={{
                flex: 1,
                overflow: 'hidden',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                position: 'relative',
              }}
            >
              <div
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CodeEditorContainer
                  filePath={selectedFile}
                  repoLabel={`${owner}/${repo}`}
                  scrollToLine={
                    diffs.has(selectedFile) && diffs.get(selectedFile)!.hunks.length > 0
                      ? diffs.get(selectedFile)!.hunks[0].newStart
                      : undefined
                  }
                />
              </div>
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
              Select a file to view its full content
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

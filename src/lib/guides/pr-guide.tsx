// PR Guide Generator - Creates guide sections based on PR data
import React from 'react';
import type { PullRequest, PullRequestFile, PullRequestDiff } from '@/types';
import { GuideSection } from '@/lib/project-guides';

export function createPRGuide(
  pr: PullRequest,
  files: PullRequestFile[],
  diffs: Map<string, PullRequestDiff>,
  onFileClick: (path: string) => void
): GuideSection[] {
  const totalAdditions = files.reduce((acc, f) => acc + f.additions, 0);
  const totalDeletions = files.reduce((acc, f) => acc + f.deletions, 0);
  const modifiedFiles = files.filter((f) => f.status === 'modified');
  const addedFiles = files.filter((f) => f.status === 'added');
  const removedFiles = files.filter((f) => f.status === 'removed');
  const renamedFiles = files.filter((f) => f.status === 'renamed');

  // Find files with most changes
  const filesByChanges = [...files].sort(
    (a, b) => b.additions + b.deletions - (a.additions + a.deletions)
  );
  const largestFiles = filesByChanges.slice(0, 5);

  return [
    {
      id: 'pr-overview',
      title: 'PR Overview',
      body: (
        <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '12px' }}>
            <strong>#{pr.number}: {pr.title}</strong>
          </div>
          {pr.body && (
            <div style={{ marginBottom: '12px', padding: '8px', background: 'var(--vscode-textCodeBlock-background)', borderRadius: '4px' }}>
              {pr.body.split('\n').slice(0, 10).map((line, i) => (
                <div key={i}>{line || '\u00A0'}</div>
              ))}
              {pr.body.split('\n').length > 10 && (
                <div style={{ opacity: 0.7, marginTop: '4px' }}>...</div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
            <div>
              <span style={{ opacity: 0.7 }}>State: </span>
              <strong>{pr.state}</strong>
            </div>
            {pr.merged_at && (
              <div>
                <span style={{ opacity: 0.7 }}>Merged: </span>
                <strong>{new Date(pr.merged_at).toLocaleDateString()}</strong>
              </div>
            )}
            <div>
              <span style={{ opacity: 0.7 }}>Author: </span>
              <strong>{pr.user.login}</strong>
            </div>
          </div>
          <div style={{ marginTop: '12px', padding: '8px', background: 'var(--vscode-textCodeBlock-background)', borderRadius: '4px' }}>
            <a
              href={pr.html_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--vscode-textLink-foreground)', textDecoration: 'none' }}
            >
              View on GitHub →
            </a>
          </div>
        </div>
      ),
    },
    {
      id: 'pr-summary',
      title: 'Summary',
      body: (
        <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <div style={{ padding: '8px', background: 'var(--vscode-textCodeBlock-background)', borderRadius: '4px' }}>
              <div style={{ opacity: 0.7, fontSize: '11px' }}>Files Changed</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{files.length}</div>
            </div>
            <div style={{ padding: '8px', background: 'var(--vscode-textCodeBlock-background)', borderRadius: '4px' }}>
              <div style={{ opacity: 0.7, fontSize: '11px' }}>Total Changes</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                +{totalAdditions} / -{totalDeletions}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Change Types:</div>
            {modifiedFiles.length > 0 && (
              <div style={{ marginBottom: '4px' }}>
                ✏️ Modified: <strong>{modifiedFiles.length}</strong> file{modifiedFiles.length !== 1 ? 's' : ''}
              </div>
            )}
            {addedFiles.length > 0 && (
              <div style={{ marginBottom: '4px' }}>
                ➕ Added: <strong>{addedFiles.length}</strong> file{addedFiles.length !== 1 ? 's' : ''}
              </div>
            )}
            {removedFiles.length > 0 && (
              <div style={{ marginBottom: '4px' }}>
                ➖ Removed: <strong>{removedFiles.length}</strong> file{removedFiles.length !== 1 ? 's' : ''}
              </div>
            )}
            {renamedFiles.length > 0 && (
              <div style={{ marginBottom: '4px' }}>
                ↪️ Renamed: <strong>{renamedFiles.length}</strong> file{renamedFiles.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'pr-files',
      title: 'Files Changed',
      body: (
        <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '12px', opacity: 0.7, fontSize: '11px' }}>
            Click a file to view its changes
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {files.slice(0, 20).map((file) => (
              <div
                key={file.filename}
                onClick={() => onFileClick(file.filename)}
                style={{
                  padding: '8px 12px',
                  background: 'var(--vscode-textCodeBlock-background)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)';
                  e.currentTarget.style.borderColor = 'var(--vscode-textLink-foreground)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--vscode-textCodeBlock-background)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file.filename}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '11px', marginLeft: '8px' }}>
                    {file.additions > 0 && (
                      <span style={{ color: 'var(--vscode-testing-iconPassed)' }}>+{file.additions}</span>
                    )}
                    {file.deletions > 0 && (
                      <span style={{ color: 'var(--vscode-errorForeground)' }}>-{file.deletions}</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
                  {file.status === 'added' && '➕ Added'}
                  {file.status === 'removed' && '➖ Removed'}
                  {file.status === 'modified' && '✏️ Modified'}
                  {file.status === 'renamed' && `↪️ Renamed${file.previous_filename ? ` from ${file.previous_filename}` : ''}`}
                </div>
              </div>
            ))}
            {files.length > 20 && (
              <div style={{ padding: '8px', textAlign: 'center', opacity: 0.7, fontSize: '11px' }}>
                ... and {files.length - 20} more file{files.length - 20 !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'pr-key-changes',
      title: 'Key Changes',
      body: (
        <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '12px', opacity: 0.7, fontSize: '11px' }}>
            Files with the most significant changes
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {largestFiles.map((file) => {
              const diff = diffs.get(file.filename);
              const hunkCount = diff?.hunks.length || 0;
              return (
                <div
                  key={file.filename}
                  onClick={() => onFileClick(file.filename)}
                  style={{
                    padding: '10px',
                    background: 'var(--vscode-textCodeBlock-background)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)';
                    e.currentTarget.style.borderColor = 'var(--vscode-textLink-foreground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--vscode-textCodeBlock-background)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                    {file.filename}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', opacity: 0.8 }}>
                    <span>
                      {file.additions + file.deletions} total changes
                    </span>
                    {hunkCount > 0 && (
                      <span>
                        {hunkCount} hunk{hunkCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span style={{ color: 'var(--vscode-testing-iconPassed)' }}>
                      +{file.additions}
                    </span>
                    <span style={{ color: 'var(--vscode-errorForeground)' }}>
                      -{file.deletions}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      id: 'pr-review-points',
      title: 'Review Points',
      body: (
        <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '12px' }}>
            <strong>Things to review carefully:</strong>
          </div>
          {files.filter((f) => f.additions + f.deletions > 100).length > 0 && (
            <div style={{ marginBottom: '12px', padding: '8px', background: 'var(--vscode-textCodeBlock-background)', borderRadius: '4px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠️ Large Changes</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                {files.filter((f) => f.additions + f.deletions > 100).length} file{files.filter((f) => f.additions + f.deletions > 100).length !== 1 ? 's' : ''} with more than 100 changes
              </div>
            </div>
          )}
          {removedFiles.length > 0 && (
            <div style={{ marginBottom: '12px', padding: '8px', background: 'var(--vscode-textCodeBlock-background)', borderRadius: '4px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠️ Removed Files</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                {removedFiles.length} file{removedFiles.length !== 1 ? 's' : ''} removed - verify they aren't needed elsewhere
              </div>
            </div>
          )}
          <div style={{ marginTop: '12px', padding: '8px', background: 'var(--vscode-textCodeBlock-background)', borderRadius: '4px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>💡 Review Checklist:</div>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '11px', lineHeight: '1.8' }}>
              <li>Check if large changes maintain code quality</li>
              <li>Verify removed code isn't needed elsewhere</li>
              <li>Ensure new code follows project conventions</li>
              <li>Test edge cases for modified logic</li>
              <li>Review error handling and edge cases</li>
            </ul>
          </div>
        </div>
      ),
    },
  ];
}


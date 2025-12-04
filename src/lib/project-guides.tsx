// Generic project guide configuration system
import React from 'react';
import { QuizQuestion } from '@/components/ChapterQuiz';

export interface FileRecommendation {
  path: string;
  description?: string;
  type?: 'docs' | 'source';
}

export interface GuideSection {
  id: string;
  title: string;
  body: React.ReactNode;
  fileRecommendations?: {
    docs?: FileRecommendation[];
    source?: FileRecommendation[];
  };
  quiz?: QuizQuestion[];
}

export interface ProjectGuide {
  id: string;
  name: string;
  description?: string;
  sections: GuideSection[];
  defaultOpenIds?: string[];
}

export interface ProjectConfig {
  id: string;
  name: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  guides: ProjectGuide[];
  suggestions?: {
    pathBased?: Record<string, unknown[]>;
    patternBased?: Array<{ pattern: RegExp; suggestions: unknown[] }>;
    fundamental?: unknown[];
  };
}

// Helper to create file recommendations component
export function createFileRecommendationsComponent(
  docs: FileRecommendation[] = [],
  source: FileRecommendation[] = [],
  onFileClick: (path: string) => void
) {
  return (
    <div style={{ marginTop: '16px', marginBottom: '16px' }}>
      {docs.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--vscode-textLink-foreground)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            📚 Documentation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {docs.map((file) => (
              <button
                key={file.path}
                onClick={() => onFileClick(file.path)}
                style={{
                  textAlign: 'left',
                  padding: '6px 10px',
                  fontSize: '12px',
                  background: 'var(--vscode-textBlockQuote-background, rgba(100, 150, 200, 0.1))',
                  border: '1px solid var(--vscode-textBlockQuote-border, rgba(100, 150, 200, 0.2))',
                  borderRadius: '4px',
                  color: 'var(--vscode-textLink-foreground, #4a9eff)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    'var(--vscode-textBlockQuote-background, rgba(100, 150, 200, 0.2))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    'var(--vscode-textBlockQuote-background, rgba(100, 150, 200, 0.1))';
                }}
              >
                <div style={{ fontFamily: 'monospace', fontWeight: 500 }}>{file.path}</div>
                {file.description && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--vscode-descriptionForeground, #999)',
                      marginTop: '2px',
                    }}
                  >
                    {file.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      {source.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--vscode-textPreformat-foreground, #d4d4d4)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            💻 Source Code
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {source.map((file) => (
              <button
                key={file.path}
                onClick={() => onFileClick(file.path)}
                style={{
                  textAlign: 'left',
                  padding: '6px 10px',
                  fontSize: '12px',
                  background: 'var(--vscode-editor-background, #1e1e1e)',
                  border: '1px solid var(--vscode-panel-border, #3e3e3e)',
                  borderRadius: '4px',
                  color: 'var(--vscode-foreground, #d4d4d4)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)';
                  e.currentTarget.style.borderColor = 'var(--vscode-focusBorder, #007acc)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--vscode-editor-background, #1e1e1e)';
                  e.currentTarget.style.borderColor = 'var(--vscode-panel-border, #3e3e3e)';
                }}
              >
                <div style={{ fontFamily: 'monospace', fontWeight: 500 }}>{file.path}</div>
                {file.description && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--vscode-descriptionForeground, #999)',
                      marginTop: '2px',
                    }}
                  >
                    {file.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Get project config by owner/repo
export function getProjectConfig(owner: string, repo: string): ProjectConfig | null {
  const configs: Record<string, ProjectConfig> = {
    'torvalds/linux': {
      id: 'linux-kernel',
      name: 'Linux Kernel',
      owner: 'torvalds',
      repo: 'linux',
      defaultBranch: 'linux-6.1.y',
      guides: [
        {
          id: 'linux-kernel-guide',
          name: 'Linux Kernel In The Mind',
          description: 'Understanding Linux Kernel Before Code',
          sections: [], // Will be populated by guide factory
          defaultOpenIds: ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8', 'ch9'],
        },
      ],
      suggestions: {
        fundamental: [],
      },
    },
    'llvm/llvm-project': {
      id: 'llvm',
      name: 'LLVM',
      owner: 'llvm',
      repo: 'llvm-project',
      defaultBranch: 'main',
      guides: [
        {
          id: 'llvm-guide',
          name: 'LLVM Compiler Infrastructure In The Mind',
          description: 'Understanding LLVM Before Code',
          sections: [], // Will be populated by guide factory
          defaultOpenIds: ['ch1', 'ch2', 'ch3', 'ch4'],
        },
      ],
      suggestions: {
        fundamental: [],
      },
    },
  };

  const key = `${owner}/${repo}`;
  return configs[key] || null;
}

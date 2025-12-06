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
      defaultBranch: 'v6.1',
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
      defaultBranch: 'llvmorg-18.1.0',
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
    'bminor/glibc': {
      id: 'glibc',
      name: 'GNU C Library (glibc)',
      owner: 'bminor',
      repo: 'glibc',
      defaultBranch: 'glibc-2.39',
      guides: [
        {
          id: 'glibc-guide',
          name: 'glibc In The Mind',
          description: 'Understanding glibc Before Code',
          sections: [], // Will be populated by guide factory
          defaultOpenIds: ['ch1', 'ch2', 'ch3', 'ch4'],
        },
      ],
      suggestions: {
        fundamental: [],
      },
    },
    'python/cpython': {
      id: 'cpython',
      name: 'CPython',
      owner: 'python',
      repo: 'cpython',
      defaultBranch: 'v3.12.0',
      guides: [
        {
          id: 'cpython-guide',
          name: 'CPython In The Mind',
          description: 'Understanding CPython Before Code',
          sections: [], // Will be populated by guide factory
          defaultOpenIds: ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'],
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

// Create a generic guide for unsupported repositories
export function createGenericGuide(owner: string, repo: string): GuideSection[] {
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const explorarRepoUrl = 'https://github.com/pkill37/explorar.dev';

  return [
    {
      id: 'contribute',
      title: 'Help Us Support This Repository',
      body: (
        <div>
          <div
            style={{
              background: 'var(--vscode-textBlockQuote-background, rgba(100, 150, 200, 0.1))',
              border: '1px solid var(--vscode-textBlockQuote-border, rgba(100, 150, 200, 0.3))',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--vscode-textLink-foreground, #4a9eff)',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>💡</span>
              <span>Learning Experience Coming Soon</span>
            </div>
            <p
              style={{ marginBottom: '16px', lineHeight: '1.6', color: 'var(--vscode-foreground)' }}
            >
              We're working on building great learning experiences for repositories like{' '}
              <strong style={{ color: 'var(--vscode-textLink-foreground)' }}>
                {owner}/{repo}
              </strong>
              . While we're building automated ways to generate these experiences, you can help us
              prioritize this repository!
            </p>
            <div
              style={{
                background: 'var(--vscode-editor-background, rgba(30, 30, 30, 0.5))',
                border: '1px solid var(--vscode-panel-border, rgba(62, 62, 62, 0.5))',
                borderRadius: '6px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <p
                style={{
                  marginBottom: '12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--vscode-foreground)',
                }}
              >
                <strong>How you can help:</strong>
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '20px',
                  lineHeight: '1.8',
                  color: 'var(--vscode-foreground)',
                }}
              >
                <li>
                  Open an issue or discussion on{' '}
                  <a
                    href={explorarRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--vscode-textLink-foreground, #4a9eff)',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'none';
                    }}
                  >
                    our GitHub repository
                  </a>{' '}
                  requesting support for this repository
                </li>
                <li>
                  Contribute a learning guide by creating a guide file following our existing
                  patterns
                </li>
                <li>
                  Share your ideas on how we can automatically generate learning experiences for
                  arbitrary repositories
                </li>
              </ul>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a
                href={`${explorarRepoUrl}/issues/new?title=Request%20support%20for%20${encodeURIComponent(owner + '/' + repo)}&body=Please%20add%20learning%20experience%20support%20for%20${encodeURIComponent(owner + '/' + repo)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  background: 'var(--vscode-button-background, #0e639c)',
                  color: 'var(--vscode-button-foreground, #ffffff)',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    'var(--vscode-button-hoverBackground, #1177bb)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--vscode-button-background, #0e639c)';
                }}
              >
                <span>📝</span>
                <span>Request Support</span>
              </a>
              <a
                href={explorarRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  background: 'transparent',
                  color: 'var(--vscode-textLink-foreground, #4a9eff)',
                  border: '1px solid var(--vscode-textLink-foreground, #4a9eff)',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    'var(--vscode-textBlockQuote-background, rgba(100, 150, 200, 0.2))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span>🔓</span>
                <span>View Repository</span>
              </a>
            </div>
          </div>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--vscode-descriptionForeground, #999)',
              fontStyle: 'italic',
              marginTop: '16px',
              lineHeight: '1.5',
            }}
          >
            In the meantime, you can still explore the source code of{' '}
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--vscode-textLink-foreground, #4a9eff)',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              {owner}/{repo}
            </a>{' '}
            using our code explorer. We're continuously working on expanding our learning
            experiences!
          </p>
        </div>
      ),
    },
  ];
}

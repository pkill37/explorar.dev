'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface ContributeScreenProps {
  owner: string;
  repo: string;
}

export default function ContributeScreen({ owner, repo }: ContributeScreenProps) {
  const router = useRouter();
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const explorarRepoUrl = 'https://github.com/pkill37/explorar.dev';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--vscode-editor-background, #1e1e1e)',
        color: 'var(--vscode-foreground, #d4d4d4)',
        padding: '40px',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: '800px', width: '100%' }}>
        <div
          style={{
            background: 'var(--vscode-textBlockQuote-background, rgba(100, 150, 200, 0.1))',
            border: '1px solid var(--vscode-textBlockQuote-border, rgba(100, 150, 200, 0.3))',
            borderRadius: '12px',
            padding: '40px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--vscode-textLink-foreground, #4a9eff)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span>💡</span>
            <span>Repository Not Yet Curated</span>
          </div>
          <p
            style={{
              marginBottom: '24px',
              lineHeight: '1.8',
              fontSize: '16px',
              color: 'var(--vscode-foreground)',
            }}
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
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            <p
              style={{
                marginBottom: '16px',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--vscode-foreground)',
              }}
            >
              <strong>How you can help:</strong>
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: '24px',
                lineHeight: '2',
                color: 'var(--vscode-foreground)',
                fontSize: '14px',
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
                Contribute a learning guide by creating a guide file following our existing patterns
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
                gap: '8px',
                padding: '12px 24px',
                background: 'var(--vscode-button-background, #0e639c)',
                color: 'var(--vscode-button-foreground, #ffffff)',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--vscode-button-hoverBackground, #1177bb)';
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
                gap: '8px',
                padding: '12px 24px',
                background: 'transparent',
                color: 'var(--vscode-textLink-foreground, #4a9eff)',
                border: '1px solid var(--vscode-textLink-foreground, #4a9eff)',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '14px',
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
            <button
              onClick={() => router.push('/')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: 'transparent',
                color: 'var(--vscode-foreground, #d4d4d4)',
                border: '1px solid var(--vscode-panel-border, #3e3e3e)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)';
                e.currentTarget.style.borderColor = 'var(--vscode-focusBorder, #007acc)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--vscode-panel-border, #3e3e3e)';
              }}
            >
              <span>←</span>
              <span>Back to Home</span>
            </button>
          </div>
        </div>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--vscode-descriptionForeground, #999)',
            fontStyle: 'italic',
            textAlign: 'center',
            lineHeight: '1.6',
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
          directly on GitHub. We're continuously working on expanding our learning experiences!
        </p>
      </div>
    </div>
  );
}

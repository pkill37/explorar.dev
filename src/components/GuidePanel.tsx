'use client';
import React, { useState } from 'react';

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

interface GuidePanelProps {
  title?: string;
  sections: Section[];
  defaultOpenIds?: string[];
  onNavigateFile?: (path: string) => void;
  overallProgress?: number;
  chapterProgress?: Record<string, boolean>; // chapterId -> isCompleted
  onResetProgress?: () => void;
}

export default function GuidePanel({
  sections,
  defaultOpenIds = [],
  overallProgress = 0,
  chapterProgress = {},
  onResetProgress,
}: GuidePanelProps) {
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map((s) => [s.id, defaultOpenIds.includes(s.id)]))
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleReset = () => {
    if (showResetConfirm && onResetProgress) {
      onResetProgress();
      setShowResetConfirm(false);
    } else {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 3000);
    }
  };

  const [showShareMenu, setShowShareMenu] = useState(false);

  const handleShare = (platform: string) => {
    const shareText = `Explore the Linux kernel source code with interactive learning! 🐧`;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(shareUrl);
    const shareTextWithUrl = `${shareText} ${shareUrl}`;
    const encodedTextWithUrl = encodeURIComponent(shareTextWithUrl);

    let shareLink = '';
    switch (platform) {
      case 'twitter':
        shareLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'linkedin':
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'reddit':
        shareLink = `https://reddit.com/submit?title=${encodedText}&url=${encodedUrl}`;
        break;
      case 'whatsapp':
        shareLink = `https://wa.me/?text=${encodedTextWithUrl}`;
        break;
      case 'hackernews':
        shareLink = `https://news.ycombinator.com/submitlink?u=${encodedUrl}&t=${encodedText}`;
        break;
    }

    if (shareLink) {
      window.open(shareLink, '_blank', 'width=550,height=420');
      setShowShareMenu(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Overall Progress Bar - Fixed at top */}
      <div className="guide-progress-container">
        <div className="guide-progress-header">
          <div
            style={{
              fontSize: '9px',
              color: 'var(--vscode-text-secondary)',
              opacity: 0.7,
            }}
          >
            Based on "Kernel In The Mind" by Moon Hee Lee
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <a
              href="https://github.com/pkill37/explorar.dev"
              target="_blank"
              rel="noopener noreferrer"
              title="View source code on GitHub"
              style={{
                background: 'transparent',
                border: '1px solid var(--vscode-border)',
                borderRadius: '3px',
                padding: '4px 8px',
                cursor: 'pointer',
                color: 'var(--vscode-text-primary)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--vscode-bg-hover)';
                e.currentTarget.style.borderColor = 'var(--vscode-text-accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--vscode-border)';
              }}
            >
              🔓 Open Source
            </a>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="guide-share-button"
                title="Share this page"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--vscode-border)',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  color: 'var(--vscode-text-primary)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--vscode-bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--vscode-text-accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--vscode-border)';
                }}
              >
                📤 Share
              </button>
              {showShareMenu && (
                <div
                  className="guide-share-menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    background: 'var(--vscode-bg-secondary)',
                    border: '1px solid var(--vscode-border)',
                    borderRadius: '4px',
                    padding: '4px',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    minWidth: '140px',
                  }}
                  onMouseLeave={() => setShowShareMenu(false)}
                >
                  <button
                    onClick={() => handleShare('hackernews')}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      color: 'var(--vscode-text-primary)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--vscode-bg-hover)';
                    }}
                  >
                    🟠 Hacker News
                  </button>
                  <button
                    onClick={() => handleShare('twitter')}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      color: 'var(--vscode-text-primary)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--vscode-bg-hover)';
                    }}
                  >
                    🐦 Twitter
                  </button>
                  <button
                    onClick={() => handleShare('reddit')}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      color: 'var(--vscode-text-primary)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--vscode-bg-hover)';
                    }}
                  >
                    🤖 Reddit
                  </button>
                  <button
                    onClick={() => handleShare('linkedin')}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      color: 'var(--vscode-text-primary)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--vscode-bg-hover)';
                    }}
                  >
                    💼 LinkedIn
                  </button>
                  <button
                    onClick={() => handleShare('whatsapp')}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      color: 'var(--vscode-text-primary)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--vscode-bg-hover)';
                    }}
                  >
                    💬 WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="guide-progress-bar" style={{ flex: 1 }}>
            <div className="guide-progress-fill" style={{ width: `${overallProgress}%` }} />
          </div>
          <span className="guide-progress-percentage">{overallProgress}%</span>
          {onResetProgress && (
            <button
              onClick={handleReset}
              className="guide-reset-button"
              title={showResetConfirm ? 'Click again to confirm reset' : 'Reset all progress'}
              style={{
                background: showResetConfirm
                  ? 'var(--vscode-text-error, #f48771)'
                  : 'transparent',
                border: `1px solid ${showResetConfirm ? 'var(--vscode-text-error, #f48771)' : 'var(--vscode-border)'}`,
                borderRadius: '3px',
                padding: '4px 8px',
                cursor: 'pointer',
                color: showResetConfirm ? 'white' : 'var(--vscode-text-primary)',
                fontSize: '11px',
                fontWeight: 500,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              onMouseEnter={(e) => {
                if (!showResetConfirm) {
                  e.currentTarget.style.background = 'var(--vscode-bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--vscode-text-error, #f48771)';
                }
              }}
              onMouseLeave={(e) => {
                if (!showResetConfirm) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--vscode-border)';
                }
              }}
            >
              {showResetConfirm ? '⚠️ Confirm' : '🔄 Reset'}
            </button>
          )}
        </div>
      </div>

      {/* Chapter Sections - Scrollable */}
      <div className="guide-sections-container">
        {sections.map((s) => {
          const isCompleted = chapterProgress[s.id] || false;

          return (
            <div key={s.id} className="vscode-guide-section">
              <div className="vscode-guide-header" onClick={() => toggle(s.id)}>
                <span className="guide-expand-icon">{open[s.id] ? '▾' : '▸'}</span>
                <span className="guide-title-text">{s.title}</span>
                {isCompleted && (
                  <span className="guide-completion-badge" title="Quiz completed">
                    ✓
                  </span>
                )}
              </div>
              {open[s.id] && <div className="vscode-guide-content">{s.body}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

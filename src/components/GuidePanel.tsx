'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

interface Guide {
  id: string;
  name: string;
  sections: Section[];
}

interface GuidePanelProps {
  title?: string;
  sections?: Section[]; // For backward compatibility
  guides?: Guide[]; // New: support multiple guides
  defaultOpenIds?: string[];
  onNavigateFile?: (path: string) => void;
  overallProgress?: number;
  chapterProgress?: Record<string, boolean>; // chapterId -> isCompleted
  onResetProgress?: () => void;
}

export default function GuidePanel({
  sections,
  guides,
  defaultOpenIds = [],
  overallProgress = 0,
  chapterProgress = {},
  onResetProgress,
}: GuidePanelProps) {
  // Support both old (sections) and new (guides) API
  const guideList: Guide[] =
    guides || (sections ? [{ id: 'default', name: 'Kernel In The Mind', sections }] : []);
  const [selectedGuideId, setSelectedGuideId] = useState<string>(guideList[0]?.id || 'default');
  const currentGuide = guideList.find((g) => g.id === selectedGuideId) || guideList[0];
  const currentSections = useMemo(() => currentGuide?.sections || [], [currentGuide?.sections]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load persisted open state from localStorage
  const loadOpenState = (): Record<string, boolean> => {
    if (typeof window === 'undefined') {
      return Object.fromEntries(currentSections.map((s) => [s.id, defaultOpenIds.includes(s.id)]));
    }
    try {
      const saved = localStorage.getItem('guide-panel-open-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with current sections, preserving saved state where available
        const merged: Record<string, boolean> = {};
        currentSections.forEach((s) => {
          merged[s.id] = parsed[s.id] ?? defaultOpenIds.includes(s.id);
        });
        return merged;
      }
    } catch (error) {
      console.warn('Failed to load guide panel open state:', error);
    }
    return Object.fromEntries(currentSections.map((s) => [s.id, defaultOpenIds.includes(s.id)]));
  };

  const [open, setOpen] = useState<Record<string, boolean>>(loadOpenState);
  const [showGuideDropdown, setShowGuideDropdown] = useState(false);

  // Save open state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('guide-panel-open-state', JSON.stringify(open));
      } catch (error) {
        console.warn('Failed to save guide panel open state:', error);
      }
    }
  }, [open]);

  // Update open state when guide changes, but preserve existing state
  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(() => {
      setOpen((prev) => {
        const updated: Record<string, boolean> = {};
        currentSections.forEach((s) => {
          // Preserve existing state if available, otherwise use default
          updated[s.id] = prev[s.id] ?? defaultOpenIds.includes(s.id);
        });
        return updated;
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedGuideId, currentSections, defaultOpenIds]);

  // Load and restore scroll position on mount and when sections change
  useEffect(() => {
    if (typeof window !== 'undefined' && scrollContainerRef.current) {
      try {
        const savedScroll = localStorage.getItem('guide-panel-scroll-position');
        if (savedScroll) {
          const scrollPosition = parseInt(savedScroll, 10);
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollPosition;
            }
          });
        }
      } catch (error) {
        console.warn('Failed to load guide panel scroll position:', error);
      }
    }
  }, [currentSections]);

  // Save scroll position on scroll
  const handleScroll = () => {
    if (scrollContainerRef.current && typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'guide-panel-scroll-position',
          scrollContainerRef.current.scrollTop.toString()
        );
      } catch (error) {
        console.warn('Failed to save guide panel scroll position:', error);
      }
    }
  };

  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleReset = () => {
    if (onResetProgress) {
      const confirmed = window.confirm(
        'Are you sure you want to reset all progress? This action cannot be undone.'
      );
      if (confirmed) {
        onResetProgress();
      }
    }
  };

  const [showShareMenu, setShowShareMenu] = useState(false);

  const handleShare = (platform: string) => {
    const shareText = `Explore source code with interactive learning on Explorar.dev! 🚀`;
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0, overflow: 'hidden', flex: '1 1 0%' }}>
      {/* Overall Progress Bar - Fixed at top */}
      <div className="guide-progress-container">
        <div className="guide-progress-header">
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowGuideDropdown(!showGuideDropdown)}
              style={{
                background: 'transparent',
                border: '1px solid var(--vscode-border)',
                borderRadius: '3px',
                padding: '2px 6px',
                cursor: 'pointer',
                color: 'var(--vscode-text-primary)',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
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
              {currentGuide?.name || 'Kernel In The Mind'}
              <span style={{ fontSize: '9px', opacity: 0.7 }}>▼</span>
            </button>
            {showGuideDropdown && guideList.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: 'var(--vscode-bg-secondary)',
                  border: '1px solid var(--vscode-border)',
                  borderRadius: '4px',
                  padding: '4px',
                  zIndex: 1000,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  minWidth: '180px',
                }}
                onMouseLeave={() => setShowGuideDropdown(false)}
              >
                {guideList.map((guide) => (
                  <button
                    key={guide.id}
                    onClick={() => {
                      setSelectedGuideId(guide.id);
                      setShowGuideDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 10px',
                      background:
                        selectedGuideId === guide.id ? 'var(--vscode-bg-hover)' : 'transparent',
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
                      if (selectedGuideId !== guide.id) {
                        e.currentTarget.style.background = 'var(--vscode-bg-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedGuideId !== guide.id) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {selectedGuideId === guide.id && <span>✓</span>}
                    {guide.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            <a
              href="https://github.com/pkill37/explorar.dev"
              target="_blank"
              rel="noopener noreferrer"
              title="View source code on GitHub"
              style={{
                background: 'transparent',
                border: '1px solid var(--vscode-border)',
                borderRadius: '3px',
                padding: '2px 6px',
                cursor: 'pointer',
                color: 'var(--vscode-text-primary)',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
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
              🔓 GitHub
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
                  padding: '2px 6px',
                  cursor: 'pointer',
                  color: 'var(--vscode-text-primary)',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
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
            <a
              href="https://discord.gg/fuXYz44tSs"
              target="_blank"
              rel="noopener noreferrer"
              title="Join our Discord community"
              style={{
                background: 'transparent',
                border: '1px solid var(--vscode-border)',
                borderRadius: '3px',
                padding: '2px 6px',
                cursor: 'pointer',
                color: 'var(--vscode-text-primary)',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
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
              💬 Discord
            </a>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onResetProgress && (
            <button
              onClick={handleReset}
              className="guide-reset-button"
              title="Reset all progress"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              ⏮️
            </button>
          )}
          <div className="guide-progress-bar" style={{ flex: 1 }}>
            <div className="guide-progress-fill" style={{ width: `${overallProgress}%` }} />
          </div>
          <span className="guide-progress-percentage">{overallProgress}%</span>
        </div>
      </div>

      {/* Chapter Sections - Scrollable */}
      <div ref={scrollContainerRef} className="guide-sections-container" onScroll={handleScroll}>
        {currentSections.map((s) => {
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

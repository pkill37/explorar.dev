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
  sections?: Section[]; // For backward compatibility
  guides?: Guide[]; // New: support multiple guides
  defaultOpenIds?: string[];
  /** Called with the section id whenever a section is expanded, null when collapsed */
  onActiveChapterChange?: (id: string | null) => void;
}

export default function GuidePanel({
  sections,
  guides,
  defaultOpenIds = [],
  onActiveChapterChange,
}: GuidePanelProps) {
  // Support both old (sections) and new (guides) API
  const guideList: Guide[] =
    guides || (sections ? [{ id: 'default', name: 'Kernel In The Mind', sections }] : []);
  const [selectedGuideId] = useState<string>(guideList[0]?.id || 'default');
  const currentGuide = guideList.find((g) => g.id === selectedGuideId) || guideList[0];
  const currentSections = useMemo(() => currentGuide?.sections || [], [currentGuide?.sections]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize open state with SSR-safe defaults (no localStorage on server)
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(currentSections.map((s) => [s.id, defaultOpenIds.includes(s.id)]))
  );

  // After hydration, merge with any persisted localStorage state and notify graph
  useEffect(() => {
    let activeId: string | null = null;
    try {
      const saved = localStorage.getItem('guide-panel-open-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        setOpen((prev) => {
          const merged: Record<string, boolean> = { ...prev };
          currentSections.forEach((s) => {
            if (s.id in parsed) merged[s.id] = parsed[s.id];
          });
          // Notify graph with the last open section
          const lastOpen = currentSections.filter((s) => merged[s.id]).pop();
          activeId = lastOpen?.id ?? null;
          return merged;
        });
      } else {
        // No saved state — use defaultOpenIds
        const lastOpen = currentSections.filter((s) => defaultOpenIds.includes(s.id)).pop();
        activeId = lastOpen?.id ?? null;
      }
    } catch {
      const lastOpen = currentSections.filter((s) => defaultOpenIds.includes(s.id)).pop();
      activeId = lastOpen?.id ?? null;
    }
    if (activeId) onActiveChapterChange?.(activeId);
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const toggle = (id: string) => {
    setOpen((prev) => {
      const opening = !prev[id];
      return { ...prev, [id]: opening };
    });
    // Notify outside the updater to avoid setState-during-render
    const opening = !open[id];
    if (opening) {
      onActiveChapterChange?.(id);
    } else {
      const anyOpen = Object.entries(open).some(([k, v]) => k !== id && v);
      if (!anyOpen) onActiveChapterChange?.(null);
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        minHeight: 0,
        overflow: 'hidden',
        flex: '1 1 0%',
      }}
    >
      {/* Guide Header - Compact */}
      <div className="guide-progress-container">
        <div className="guide-progress-header" style={{ marginBottom: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 500,
              textTransform: 'uppercase',
              color: 'var(--vscode-text-primary)',
            }}
          >
            GUIDE
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
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
          </div>
        </div>
      </div>

      {/* Chapter Sections - Scrollable */}
      <div ref={scrollContainerRef} className="guide-sections-container" onScroll={handleScroll}>
        {currentSections.map((s) => {
          return (
            <div key={s.id} className="vscode-guide-section">
              <div className="vscode-guide-header" onClick={() => toggle(s.id)}>
                <span className="guide-expand-icon">{open[s.id] ? '▾' : '▸'}</span>
                <span className="guide-title-text">{s.title}</span>
              </div>
              {open[s.id] && <div className="vscode-guide-content">{s.body}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

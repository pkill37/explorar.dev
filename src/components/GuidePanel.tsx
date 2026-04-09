'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

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
  sections?: Section[];
  guides?: Guide[];
  defaultOpenIds?: string[];
  onActiveChapterChange?: (id: string | null) => void;
}

// Extract a display number from chapter id: "ch1" → 1, "chapter-3-foo" → 3, else null
function chapterNumber(id: string): number | null {
  const m = id.match(/(?:^ch|chapter[-_])(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

export default function GuidePanel({
  sections,
  guides,
  defaultOpenIds = [],
  onActiveChapterChange,
}: GuidePanelProps) {
  const guideList: Guide[] =
    guides || (sections ? [{ id: 'default', name: 'Guide', sections }] : []);
  const selectedGuideId = guideList[0]?.id || 'default';
  const currentGuide = guideList.find((g) => g.id === selectedGuideId) || guideList[0];
  const currentSections = useMemo(() => currentGuide?.sections || [], [currentGuide?.sections]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Single active chapter id (accordion: only one open at a time)
  const [activeId, setActiveId] = useState<string | null>(() => {
    // First of defaultOpenIds that exists in sections
    return defaultOpenIds.find((id) => currentSections.some((s) => s.id === id)) ?? null;
  });

  // On mount, restore from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('guide-panel-active-chapter');
      if (saved && currentSections.some((s) => s.id === saved)) {
        setActiveId(saved);
        onActiveChapterChange?.(saved);
        return;
      }
    } catch {
      // ignore
    }
    // fallback: first of defaultOpenIds
    const fallback = defaultOpenIds.find((id) => currentSections.some((s) => s.id === id)) ?? null;
    if (fallback) {
      setActiveId(fallback);
      onActiveChapterChange?.(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist active chapter and notify graph whenever it changes
  useEffect(() => {
    try {
      if (activeId) localStorage.setItem('guide-panel-active-chapter', activeId);
      else localStorage.removeItem('guide-panel-active-chapter');
    } catch {
      // ignore
    }
    onActiveChapterChange?.(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Scroll active chapter into view when it opens
  useEffect(() => {
    if (!activeId) return;
    const el = sectionRefs.current[activeId];
    if (el && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const elTop = el.offsetTop;
      const elHeight = el.offsetHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      if (elTop < viewTop || elTop + elHeight > viewBottom) {
        container.scrollTo({ top: Math.max(0, elTop - 16), behavior: 'smooth' });
      }
    }
  }, [activeId]);

  // Save scroll position — debounced
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const pos = scrollContainerRef.current.scrollTop;
    if (scrollSaveTimer.current !== null) clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem('guide-panel-scroll-position', pos.toString());
      } catch {
        // ignore
      }
    }, 250);
  }, []);

  // Restore scroll on mount
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    try {
      const saved = localStorage.getItem('guide-panel-scroll-position');
      if (saved) {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current)
            scrollContainerRef.current.scrollTop = parseInt(saved, 10);
        });
      }
    } catch {
      // ignore
    }
  }, [currentSections]);

  const toggle = useCallback((id: string) => {
    setActiveId((prev) => {
      const next = prev === id ? null : id;
      return next;
    });
  }, []);

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

  const activeIndex = currentSections.findIndex((s) => s.id === activeId);
  const total = currentSections.length;

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
      {/* ── Header ── */}
      <div
        style={{
          background: 'var(--vscode-bg-tertiary)',
          borderBottom: '1px solid var(--vscode-border)',
          padding: '8px 12px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--vscode-text-muted, #555)',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            Guide
          </span>
          {total > 0 && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--vscode-text-muted, #444)',
                fontFamily: 'monospace',
                flexShrink: 0,
              }}
            >
              {activeIndex >= 0 ? activeIndex + 1 : '—'} / {total}
            </span>
          )}
          {/* Progress bar */}
          {total > 0 && (
            <div
              style={{
                flex: 1,
                height: 2,
                background: 'var(--vscode-border)',
                borderRadius: 1,
                overflow: 'hidden',
                minWidth: 24,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${activeIndex >= 0 ? ((activeIndex + 1) / total) * 100 : 0}%`,
                  background: 'var(--vscode-text-accent, #0078d4)',
                  borderRadius: 1,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          )}
        </div>

        {/* Share button */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            title="Share this page"
            style={{
              background: 'transparent',
              border: '1px solid var(--vscode-border)',
              borderRadius: 3,
              padding: '2px 6px',
              cursor: 'pointer',
              color: 'var(--vscode-text-muted, #555)',
              fontSize: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--vscode-bg-hover)';
              e.currentTarget.style.borderColor = 'var(--vscode-text-accent, #0078d4)';
              e.currentTarget.style.color = 'var(--vscode-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'var(--vscode-border)';
              e.currentTarget.style.color = 'var(--vscode-text-muted, #555)';
            }}
          >
            ↑ Share
          </button>
          {showShareMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'var(--vscode-bg-secondary)',
                border: '1px solid var(--vscode-border)',
                borderRadius: 4,
                padding: 4,
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                minWidth: 140,
              }}
              onMouseLeave={() => setShowShareMenu(false)}
            >
              {(['hackernews', 'twitter', 'reddit', 'linkedin', 'whatsapp'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handleShare(p)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 10px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                    color: 'var(--vscode-text-primary)',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--vscode-bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {p === 'hackernews' && '🟠 Hacker News'}
                  {p === 'twitter' && '🐦 Twitter'}
                  {p === 'reddit' && '🤖 Reddit'}
                  {p === 'linkedin' && '💼 LinkedIn'}
                  {p === 'whatsapp' && '💬 WhatsApp'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Chapter list ── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: '1 1 0%',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '6px 6px',
          minHeight: 0,
        }}
      >
        {currentSections.map((s, idx) => {
          const isActive = s.id === activeId;
          const num = chapterNumber(s.id) ?? idx + 1;
          const ACCENT = 'var(--vscode-text-accent, #0078d4)';

          return (
            <div
              key={s.id}
              ref={(el) => {
                sectionRefs.current[s.id] = el;
              }}
              style={{
                marginBottom: 4,
                borderRadius: 5,
                overflow: 'hidden',
                border: isActive ? `1px solid ${ACCENT}44` : '1px solid transparent',
                transition: 'border-color 0.2s ease',
              }}
            >
              {/* Chapter header row */}
              <div
                onClick={() => toggle(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0,
                  cursor: 'pointer',
                  background: isActive ? 'var(--vscode-bg-hover)' : 'var(--vscode-bg-tertiary)',
                  borderLeft: isActive ? `3px solid ${ACCENT}` : '3px solid transparent',
                  padding: isActive ? '9px 10px 9px 9px' : '7px 10px 7px 9px',
                  transition: 'background 0.15s ease, padding 0.15s ease',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background = 'var(--vscode-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background = 'var(--vscode-bg-tertiary)';
                }}
              >
                {/* Chapter number badge */}
                <span
                  style={{
                    flexShrink: 0,
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: isActive ? ACCENT : 'var(--vscode-border)',
                    color: isActive ? '#fff' : 'var(--vscode-text-muted, #555)',
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                    transition: 'background 0.2s ease, color 0.2s ease',
                    letterSpacing: 0,
                  }}
                >
                  {num}
                </span>

                {/* Title */}
                <span
                  style={{
                    flex: 1,
                    fontSize: isActive ? 12 : 11,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive
                      ? 'var(--vscode-text-primary)'
                      : 'var(--vscode-text-muted, #555)',
                    lineHeight: 1.3,
                    transition: 'color 0.15s ease, font-size 0.15s ease',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    // Strip "Chapter N — " prefix since we show the number badge
                    // Rendered as-is; the title already has leading "Chapter N — " stripped in the guide loader
                  }}
                >
                  {s.title}
                </span>

                {/* Chevron */}
                <span
                  style={{
                    flexShrink: 0,
                    marginLeft: 6,
                    fontSize: 9,
                    color: isActive ? ACCENT : 'var(--vscode-text-muted, #444)',
                    transition: 'transform 0.2s ease, color 0.2s ease',
                    transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
                    display: 'inline-block',
                  }}
                >
                  ›
                </span>
              </div>

              {/* Chapter body */}
              {isActive && (
                <div
                  style={{
                    background: 'var(--vscode-bg-secondary)',
                    borderTop: `1px solid ${ACCENT}22`,
                    padding: '12px 12px 14px',
                    color: 'var(--vscode-text-secondary)',
                    fontSize: 12,
                    lineHeight: 1.55,
                  }}
                >
                  {s.body}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

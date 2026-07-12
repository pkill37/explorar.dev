'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { notFound } from 'next/navigation';
import RepositoryWorkspaceExplorer from './components/RepositoryWorkspaceExplorer';
import { EntityView } from './components/EntityView';
import GuidePanel from './components/GuidePanel';
import LoadingScreen from '@/components/LoadingScreen';
import { getProjectConfig, createGenericGuide } from '@/lib/project-guides';
import { loadGuideFromMarkdown } from '@/features/guides/guide-loader';
import { debugLog } from '@/lib/browser-debug';
import '@/app/vscode.css';

const GUIDE_DEFAULT_WIDTH = 300;
const GUIDE_MIN_WIDTH = 200;
const GUIDE_MAX_WIDTH = 520;

interface RepositoryExplorerClientProps {
  owner: string;
  repo: string;
}

type InitialFileTarget =
  | string
  | string[]
  | {
      path: string;
      searchPattern?: string;
      scrollToLine?: number;
      searchScope?: string[];
    };

export default function RepositoryExplorerClient({ owner, repo }: RepositoryExplorerClientProps) {
  const projectConfig = getProjectConfig(owner, repo);
  if (!projectConfig) notFound();

  const [isMounted, setIsMounted] = useState(false);
  const [mode, setMode] = useState<'editor' | 'search' | 'entities'>('editor');
  const [initialFile, setInitialFile] = useState<InitialFileTarget | null>(null);
  // Keep EntityView mounted once first activated to preserve per-chapter cache
  const [entitiesMounted, setEntitiesMounted] = useState(false);

  const handleEnterFile = useCallback(
    (fileId: string, searchPattern?: string, scrollToLine?: number, searchScope?: string[]) => {
      debugLog('[explorar:open-file] guide-request', {
        fileId,
        searchPattern,
        scrollToLine,
        searchScope,
      });
      // Paired nodes encode both paths as "primary|||header"
      const paths = fileId.includes('|||') ? fileId.split('|||') : null;
      setInitialFile(
        paths ?? {
          path: fileId,
          searchPattern,
          scrollToLine,
          searchScope,
        }
      );
      setMode('editor');
    },
    []
  );

  // ── Guide sections ──────────────────────────────────────────────────────────
  // loadGuideFromMarkdown is synchronous (all guide docs are bundled at build time),
  // so it's safe to call inside useMemo.
  const guideSections = useMemo(() => {
    const guideId = projectConfig?.guides[0]?.id;
    if (guideId) {
      try {
        return loadGuideFromMarkdown(guideId, handleEnterFile);
      } catch {
        // fall through to generic
      }
    }
    return createGenericGuide(owner, repo);
  }, [projectConfig, owner, repo, handleEnterFile]);

  const defaultOpenIds = useMemo(
    () =>
      projectConfig?.guides?.[0]?.defaultOpenIds ||
      (guideSections.length > 0 ? [guideSections[0].id] : []),
    [projectConfig, guideSections]
  );

  // ── Chapter graph state ─────────────────────────────────────────────────────
  const [activeChapterId, setActiveChapterId] = useState<string | null>(
    () => defaultOpenIds[0] ?? guideSections[0]?.id ?? null
  );
  const chapterMapEntries = useMemo(
    () =>
      guideSections.map((section) => ({
        id: section.id,
        files: section.narrativePaths ?? [],
      })),
    [guideSections]
  );
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsMounted(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  // ── Guide panel resize ──────────────────────────────────────────────────────
  const [guideWidth, setGuideWidth] = useState(GUIDE_DEFAULT_WIDTH);
  const isResizingGuide = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const pendingClientX = useRef(0);
  const resizeRaf = useRef<number | null>(null);

  const handleGuideResizeStart = useCallback(
    (e: React.MouseEvent) => {
      isResizingGuide.current = true;
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = guideWidth;
      e.preventDefault();
    },
    [guideWidth]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizingGuide.current) return;
      // Capture latest X but only schedule one RAF per frame
      pendingClientX.current = e.clientX;
      if (resizeRaf.current !== null) return;
      resizeRaf.current = requestAnimationFrame(() => {
        resizeRaf.current = null;
        const delta = resizeStartX.current - pendingClientX.current;
        const next = Math.min(
          GUIDE_MAX_WIDTH,
          Math.max(GUIDE_MIN_WIDTH, resizeStartWidth.current + delta)
        );
        setGuideWidth(next);
      });
    };
    const onUp = () => {
      isResizingGuide.current = false;
      if (resizeRaf.current !== null) {
        cancelAnimationFrame(resizeRaf.current);
        resizeRaf.current = null;
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (!isMounted) {
    return <LoadingScreen />;
  }

  return (
    <main
      suppressHydrationWarning
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        background: '#0d0d0d',
      }}
    >
      <h1
        suppressHydrationWarning
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {owner}/{repo} Explorer
      </h1>
      {/* ── Activity bar ── */}
      <div
        style={{
          width: 48,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 8,
          padding: '10px 8px',
          borderRight: '1px solid #1f1f1f',
          background: '#111111',
        }}
      >
        {[
          {
            id: 'editor',
            title: 'File editor',
            label: '</>',
          },
          {
            id: 'search',
            title: 'File search',
            label: '⌕',
          },
          {
            id: 'entities',
            title: 'Entities',
            label: '⬡',
          },
        ].map((tab) => {
          const isActive = mode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'entities') {
                  setEntitiesMounted(true);
                }
                setMode(tab.id as typeof mode);
              }}
              title={tab.title}
              aria-label={tab.title}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: '1px solid',
                borderColor: isActive ? 'var(--vscode-text-accent, #0078d4)' : '#262626',
                background: isActive ? 'rgba(0, 120, 212, 0.22)' : '#171717',
                color: isActive ? '#fff' : '#a7a7a7',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'monospace',
                fontSize: tab.id === 'entities' ? 15 : 11,
                fontWeight: 700,
                boxShadow: isActive ? '0 0 0 1px rgba(0,120,212,0.25)' : 'none',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Main content area ── */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
        {/* Explorer surface — used by both editor and search tabs */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: mode === 'entities' ? 0 : 1,
            pointerEvents: mode === 'entities' ? 'none' : 'auto',
            transition: 'opacity 0.35s ease',
            zIndex: mode === 'entities' ? 0 : 1,
          }}
        >
          <RepositoryWorkspaceExplorer
            owner={owner}
            repo={repo}
            initialFile={initialFile}
            hideGuidePanel
            layoutMode={mode === 'search' ? 'search' : 'editor'}
            onOpenFileRequest={handleEnterFile}
          />
        </div>

        {/* Entities view — kept mounted to preserve per-chapter cache */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: mode === 'entities' ? 1 : 0,
            pointerEvents: mode === 'entities' ? 'auto' : 'none',
            transition: 'opacity 0.35s ease',
            zIndex: mode === 'entities' ? 1 : 0,
          }}
        >
          {(mode === 'entities' || entitiesMounted) && (
            <EntityView
              owner={owner}
              repo={repo}
              onOpenFile={handleEnterFile}
              activeChapterId={activeChapterId}
              chapterMapEntries={chapterMapEntries}
              guideSections={guideSections}
              isActive={mode === 'entities'}
            />
          )}
        </div>
      </div>

      {/* ── Guide resize handle ── */}
      <div
        onMouseDown={handleGuideResizeStart}
        style={{
          width: 4,
          cursor: 'col-resize',
          background: 'transparent',
          borderLeft: '1px solid #2a2a2a',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#3c3c3c')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
      />

      {/* ── Persistent guide sidebar ── */}
      <div
        style={{
          width: guideWidth,
          minWidth: GUIDE_MIN_WIDTH,
          maxWidth: GUIDE_MAX_WIDTH,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
          background: 'var(--vscode-bg-secondary)',
          borderLeft: '1px solid var(--vscode-border)',
        }}
      >
        {/* Guide panel — fills remaining height */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <GuidePanel
            sections={guideSections}
            activeChapterId={activeChapterId}
            onActiveChapterChange={setActiveChapterId}
          />
        </div>
      </div>
    </main>
  );
}

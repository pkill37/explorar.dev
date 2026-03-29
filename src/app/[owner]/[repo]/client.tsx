'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { notFound } from 'next/navigation';
import KernelExplorer from '@/components/KernelExplorer';
import { GraphExplorer } from '@/components/graph/GraphExplorer';
import GuidePanel from '@/components/GuidePanel';
import { getProjectConfig, createGenericGuide } from '@/lib/project-guides';
import { loadGuideFromMarkdown } from '@/lib/guides/guide-loader';
import '@/app/vscode.css';

const GUIDE_DEFAULT_WIDTH = 300;
const GUIDE_MIN_WIDTH = 200;
const GUIDE_MAX_WIDTH = 520;

interface RepositoryExplorerClientProps {
  owner: string;
  repo: string;
}

export default function RepositoryExplorerClient({ owner, repo }: RepositoryExplorerClientProps) {
  const projectConfig = getProjectConfig(owner, repo);
  if (!projectConfig) notFound();

  const [mode, setMode] = useState<'graph' | 'editor'>('graph');
  const [initialFile, setInitialFile] = useState<string | null>(null);
  // Keep KernelExplorer mounted once it has been rendered to preserve tab state
  const [editorMounted, setEditorMounted] = useState(false);

  const handleEnterFile = useCallback((filePath: string) => {
    setInitialFile(filePath);
    setEditorMounted(true);
    setMode('editor');
  }, []);

  const handleBackToGraph = useCallback(() => {
    setMode('graph');
  }, []);

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
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const chapterMapEntries = useMemo(
    () =>
      guideSections.map((s) => ({
        id: s.id,
        files: s.fileRecommendations?.source?.map((f) => f.path) ?? [],
        graph: s.graph,
      })),
    [guideSections]
  );

  // ── Guide panel resize ──────────────────────────────────────────────────────
  const [guideWidth, setGuideWidth] = useState(GUIDE_DEFAULT_WIDTH);
  const isResizingGuide = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

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
      const delta = resizeStartX.current - e.clientX;
      const next = Math.min(
        GUIDE_MAX_WIDTH,
        Math.max(GUIDE_MIN_WIDTH, resizeStartWidth.current + delta)
      );
      setGuideWidth(next);
    };
    const onUp = () => {
      isResizingGuide.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        background: '#0d0d0d',
      }}
    >
      {/* ── Main content area (graph or editor) ── */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
        {/* Graph view */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: mode === 'graph' ? 1 : 0,
            pointerEvents: mode === 'graph' ? 'auto' : 'none',
            transition: 'opacity 0.45s ease',
            zIndex: mode === 'graph' ? 1 : 0,
          }}
        >
          <GraphExplorer
            owner={owner}
            repo={repo}
            onEnterFile={handleEnterFile}
            activeChapterId={activeChapterId}
            chapterMapEntries={chapterMapEntries}
          />
        </div>

        {/* Editor view — mounted lazily, kept alive once created */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: mode === 'editor' ? 1 : 0,
            pointerEvents: mode === 'editor' ? 'auto' : 'none',
            transform: mode === 'editor' ? 'scale(1)' : 'scale(1.015)',
            transition: 'opacity 0.45s ease, transform 0.45s ease',
            zIndex: mode === 'editor' ? 1 : 0,
          }}
        >
          {(mode === 'editor' || editorMounted) && (
            <KernelExplorer
              owner={owner}
              repo={repo}
              initialFile={initialFile}
              onBackToGraph={handleBackToGraph}
              hideGuidePanel
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
        {/* Mode toggle in the guide header area */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderBottom: '1px solid var(--vscode-border)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setMode('graph')}
            title="File map"
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              padding: '3px 8px',
              borderRadius: 3,
              border: 'none',
              cursor: 'pointer',
              background: mode === 'graph' ? 'var(--vscode-text-accent, #0078d4)' : 'transparent',
              color: mode === 'graph' ? '#fff' : 'var(--vscode-text-muted, #666)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            ◈ Map
          </button>
          <button
            onClick={() => {
              if (editorMounted) setMode('editor');
            }}
            title="Code editor"
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              padding: '3px 8px',
              borderRadius: 3,
              border: 'none',
              cursor: editorMounted ? 'pointer' : 'default',
              background: mode === 'editor' ? 'var(--vscode-text-accent, #0078d4)' : 'transparent',
              color:
                mode === 'editor'
                  ? '#fff'
                  : editorMounted
                    ? 'var(--vscode-text-muted, #666)'
                    : '#333',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {'</>'} Editor
          </button>
        </div>

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
            defaultOpenIds={defaultOpenIds}
            onActiveChapterChange={setActiveChapterId}
          />
        </div>
      </div>
    </div>
  );
}

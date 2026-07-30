'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { notFound } from 'next/navigation';
import RepositoryWorkspaceExplorer from './components/RepositoryWorkspaceExplorer';
import { EntityView } from './components/EntityView';
import GuidePanel from './components/GuidePanel';
import StatusBar from './components/StatusBar';
import LoadingScreen from '@/components/LoadingScreen';
import { getProjectConfig, createGenericGuide } from '@/lib/project-guides';
import { loadGuideFromMarkdown } from '@/features/guides/guide-loader';
import { debugLog } from '@/lib/browser-debug';
import { useRepository } from '@/contexts/RepositoryContext';
import {
  getDefaultCuratedRepoSourceMode,
  hasConfiguredR2BucketBaseUrl,
  isLocalFilesystemCorpusAvailable,
  normalizeCuratedRepoSourceMode,
} from '@/lib/curated-content-url';
import type { CuratedRepoSourceMode } from '@/lib/repo-static';
import '@/app/vscode.css';

const GUIDE_DEFAULT_WIDTH = 300;
const GUIDE_MIN_WIDTH = 200;
const GUIDE_MAX_WIDTH = 520;
const GUIDE_COLLAPSED_WIDTH = 44;
const ENTITY_CONTEXT_WIDTH = 420;
const CORPUS_SOURCE_MODE_STORAGE_KEY = 'repository-workspace-explorer-corpus-source-mode';
const GUIDE_SIDEBAR_OPEN_STORAGE_KEY = 'repository-explorer-guide-sidebar-open';
let navigationNonceCounter = 0;

function createNavigationNonce(): number {
  navigationNonceCounter = (navigationNonceCounter + 1) % Number.MAX_SAFE_INTEGER;
  return Date.now() + navigationNonceCounter / 1000000;
}

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
      navigationNonce?: number;
    };

export default function RepositoryExplorerClient({ owner, repo }: RepositoryExplorerClientProps) {
  const projectConfig = getProjectConfig(owner, repo);
  if (!projectConfig) notFound();

  const { currentBranch } = useRepository();
  const [isMounted, setIsMounted] = useState(false);
  const [mode, setMode] = useState<'editor' | 'search' | 'entities'>('editor');
  const [fileSourceMode, setFileSourceMode] = useState<CuratedRepoSourceMode>(() =>
    getDefaultCuratedRepoSourceMode()
  );
  const [initialFile, setInitialFile] = useState<InitialFileTarget | null>(null);
  const [isGuideSidebarOpen, setIsGuideSidebarOpen] = useState(() => {
    try {
      if (typeof window === 'undefined') return true;
      const savedGuideSidebarOpen = localStorage.getItem(GUIDE_SIDEBAR_OPEN_STORAGE_KEY);
      if (savedGuideSidebarOpen === 'true' || savedGuideSidebarOpen === 'false') {
        return savedGuideSidebarOpen === 'true';
      }
    } catch {
      // Keep the default visible sidebar.
    }
    return true;
  });
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
      const navigationNonce = createNavigationNonce();
      setInitialFile(
        paths ?? {
          path: fileId,
          searchPattern,
          scrollToLine,
          searchScope,
          navigationNonce,
        }
      );
      setMode('editor');
    },
    []
  );

  const handleOpenFileInCurrentMode = useCallback(
    (fileId: string, searchPattern?: string, scrollToLine?: number, searchScope?: string[]) => {
      debugLog('[explorar:open-file] context-request', {
        fileId,
        searchPattern,
        scrollToLine,
        searchScope,
      });
      const paths = fileId.includes('|||') ? fileId.split('|||') : null;
      const navigationNonce = createNavigationNonce();
      setInitialFile(
        paths ?? {
          path: fileId,
          searchPattern,
          scrollToLine,
          searchScope,
          navigationNonce,
        }
      );
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
  const repoLabel = `${owner}/${repo}`;
  const statusBranch = currentBranch || projectConfig.defaultRevision;
  const showDevSourceMode = isLocalFilesystemCorpusAvailable();
  const isR2SourceConfigured = hasConfiguredR2BucketBaseUrl();

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
    let nextSourceMode = getDefaultCuratedRepoSourceMode();
    try {
      const savedSourceMode = localStorage.getItem(CORPUS_SOURCE_MODE_STORAGE_KEY);
      if (savedSourceMode === 'local-filesystem' || savedSourceMode === 'r2-bucket') {
        nextSourceMode = savedSourceMode;
      }
    } catch {
      // Keep the environment default.
    }
    nextSourceMode = normalizeCuratedRepoSourceMode(nextSourceMode);
    const timeoutId = window.setTimeout(() => {
      setFileSourceMode(nextSourceMode);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleSourceModeChange = useCallback((sourceMode: CuratedRepoSourceMode) => {
    setFileSourceMode(normalizeCuratedRepoSourceMode(sourceMode));
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsMounted(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(GUIDE_SIDEBAR_OPEN_STORAGE_KEY, String(isGuideSidebarOpen));
    } catch {
      // Ignore storage failures.
    }
  }, [isGuideSidebarOpen]);

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
        flexDirection: 'column',
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
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row' }}>
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
              label: '{}',
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
                  width: 36,
                  height: 36,
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
                  fontSize: tab.id === 'editor' ? 15 : 21,
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
              top: 0,
              right: 0,
              bottom: 0,
              left: mode === 'entities' ? ENTITY_CONTEXT_WIDTH : 0,
              opacity: 1,
              pointerEvents: 'auto',
              transition: 'opacity 0.35s ease',
              zIndex: 1,
            }}
          >
            <RepositoryWorkspaceExplorer
              owner={owner}
              repo={repo}
              initialFile={initialFile}
              hideGuidePanel
              layoutMode={mode === 'search' ? 'search' : mode === 'entities' ? 'viewer' : 'editor'}
              sourceMode={fileSourceMode}
              onSourceModeChange={handleSourceModeChange}
            />
          </div>

          {/* Entities context — kept mounted to preserve per-chapter cache */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: ENTITY_CONTEXT_WIDTH,
              opacity: mode === 'entities' ? 1 : 0,
              pointerEvents: mode === 'entities' ? 'auto' : 'none',
              transition: 'opacity 0.35s ease',
              zIndex: mode === 'entities' ? 2 : 0,
              borderRight: '1px solid var(--vscode-border)',
              background: '#0b0b0b',
            }}
          >
            {(mode === 'entities' || entitiesMounted) && (
              <EntityView
                owner={owner}
                repo={repo}
                onOpenFile={handleOpenFileInCurrentMode}
                activeChapterId={activeChapterId}
                chapterMapEntries={chapterMapEntries}
                guideSections={guideSections}
                isActive={mode === 'entities'}
                sourceMode={fileSourceMode}
              />
            )}
          </div>
        </div>

        {/* ── Guide resize handle ── */}
        {isGuideSidebarOpen && (
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
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'transparent')
            }
          />
        )}

        {/* ── Persistent guide sidebar ── */}
        <div
          style={{
            width: isGuideSidebarOpen ? guideWidth : GUIDE_COLLAPSED_WIDTH,
            minWidth: isGuideSidebarOpen ? GUIDE_MIN_WIDTH : GUIDE_COLLAPSED_WIDTH,
            maxWidth: isGuideSidebarOpen ? GUIDE_MAX_WIDTH : GUIDE_COLLAPSED_WIDTH,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
            background: 'var(--vscode-bg-secondary)',
            borderLeft: '1px solid var(--vscode-border)',
            transition: 'width 0.18s ease',
          }}
        >
          {isGuideSidebarOpen ? (
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
                onSidebarToggle={() => setIsGuideSidebarOpen(false)}
                sidebarToggleLabel="Hide guide sidebar"
                sidebarToggleIcon="›"
              />
            </div>
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 8,
                background: 'var(--vscode-bg-tertiary)',
              }}
            >
              <button
                onClick={() => setIsGuideSidebarOpen(true)}
                title="Show guide sidebar"
                aria-label="Show guide sidebar"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  border: '1px solid var(--vscode-border)',
                  background: 'transparent',
                  color: 'var(--vscode-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--vscode-bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--vscode-text-accent, #0078d4)';
                  e.currentTarget.style.color = 'var(--vscode-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--vscode-border)';
                  e.currentTarget.style.color = 'var(--vscode-text-secondary)';
                }}
              >
                ‹
              </button>
            </div>
          )}
        </div>
      </div>
      <StatusBar
        repoLabel={repoLabel}
        branch={statusBranch}
        sourceMode={showDevSourceMode ? fileSourceMode : undefined}
        canUseR2Source={isR2SourceConfigured}
        onSourceModeChange={showDevSourceMode ? handleSourceModeChange : undefined}
      />
    </main>
  );
}

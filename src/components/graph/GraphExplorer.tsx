'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';

import { FileNode } from './FileNode';
import { FolderNode } from './FolderNode';
import { GraphControls } from './GraphControls';
import { ZoomWatcher } from './ZoomWatcher';
import { GraphLegend } from './GraphLegend';
import {
  buildGraphData,
  buildCwdView,
  buildChapterView,
  FOLDER_NODE_WIDTH,
  FOLDER_NODE_HEIGHT,
  type FileNodeData,
  type FolderNodeData,
} from '@/lib/graph-data';
import {
  parseSymbols,
  findRelationships,
  RELATIONSHIP_COLORS,
  type FileSymbols,
} from '@/lib/code-analysis';
import { getGuideByRepo } from '@/lib/guides/docs-loader';
import { getProjectConfig } from '@/lib/project-guides';
import { GraphContext } from '@/contexts/GraphContext';

// Defined at module scope to avoid ReactFlow "nodeTypes changed" warnings
const nodeTypes: NodeTypes = {
  fileNode: FileNode as NodeTypes['fileNode'],
  folderNode: FolderNode as NodeTypes['folderNode'],
};

const EDGE_DASH: Record<string, string | undefined> = {
  includes: undefined,
  imports: undefined,
  calls: '5 3',
  defines: '2 3',
};

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({
  cwd,
  activeChapterId,
  onNavigate,
}: {
  cwd: string;
  activeChapterId: string | null | undefined;
  onNavigate: (path: string) => void;
}) {
  if (activeChapterId) return null; // breadcrumb hidden during chapter view

  const segments = cwd === '' ? [] : cwd.split('/');

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        pointerEvents: 'auto',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#555',
      }}
    >
      <span
        style={{ cursor: 'pointer', color: cwd === '' ? '#888' : '#555' }}
        onClick={() => onNavigate('')}
      >
        root
      </span>
      {segments.map((seg, i) => {
        const path = segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        return (
          <span key={path} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#333' }}>/</span>
            <span
              style={{ cursor: isLast ? 'default' : 'pointer', color: isLast ? '#aaa' : '#666' }}
              onClick={() => !isLast && onNavigate(path)}
            >
              {seg}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ─── ChapterHint ──────────────────────────────────────────────────────────────

/** Small label shown above the graph when in chapter view */
function ChapterHint({ activeChapterId }: { activeChapterId: string }) {
  // Format "chapter-3-the-object-model" → "The Object Model"
  const title = activeChapterId
    .replace(/^chapter-\d+-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        pointerEvents: 'none',
        zIndex: 10,
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#555',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ color: '#3a3a3a' }}>chapter ·</span>
      <span style={{ color: '#777' }}>{title}</span>
    </div>
  );
}

// ─── GraphFlow ────────────────────────────────────────────────────────────────

interface ChapterMapEntry {
  id: string;
  files: string[];
  graph?: string;
}

interface GraphFlowProps {
  owner: string;
  repo: string;
  branch: string;
  allFileNodes: Node<FileNodeData>[];
  allFileEdges: Edge[];
  activeChapterId?: string | null;
  chapterMapEntries?: ChapterMapEntry[];
  onEnterFile: (filePath: string) => void;
}

function GraphFlow({
  owner,
  repo,
  branch,
  allFileNodes,
  allFileEdges,
  activeChapterId,
  chapterMapEntries,
  onEnterFile,
}: GraphFlowProps) {
  const { fitView, setCenter } = useReactFlow();

  // ── CWD navigation (only active when no chapter) ──────────────────────────
  const [cwd, setCwd] = useState('');
  const cwdRef = useRef('');
  cwdRef.current = cwd;

  // Latest file edges (updated by analysis)
  const fileEdgesRef = useRef<Edge[]>(allFileEdges);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [symbolsMap, setSymbolsMap] = useState<Map<string, FileSymbols>>(new Map());
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // ── Initial view: root depth=1 (no chapter active) ───────────────────────
  const initialView = useMemo(
    () => buildCwdView(allFileNodes, allFileEdges, ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialView.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialView.edges);

  // ── React to chapter change ───────────────────────────────────────────────
  const prevChapterRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevChapterRef.current === activeChapterId) return;
    prevChapterRef.current = activeChapterId;

    setSelectedFilePath(null);

    if (!activeChapterId) {
      // No active chapter → return to cwd view
      const { nodes: n, edges: e } = buildCwdView(
        allFileNodes,
        fileEdgesRef.current,
        cwdRef.current
      );
      setNodes(n as Node[]);
      setEdges(e);
    } else {
      // Chapter active → show chapter-specific graph
      setCwd(''); // reset navigation context
      const entry = chapterMapEntries?.find((c) => c.id === activeChapterId);
      const { nodes: n, edges: e } = buildChapterView(
        allFileNodes,
        fileEdgesRef.current,
        entry?.files ?? [],
        entry?.graph
      );
      setNodes(n as Node[]);
      setEdges(e);
    }
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
    // stable setters + refs excluded intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapterId]);

  // ── Navigate to a new cwd (only valid outside chapter view) ──────────────
  const navigateToCwd = useCallback(
    (newCwd: string) => {
      setCwd(newCwd);
      const { nodes: n, edges: e } = buildCwdView(allFileNodes, fileEdgesRef.current, newCwd);
      setNodes(n as Node[]);
      setEdges(e);
      setSelectedFilePath(null);
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
    },
    [allFileNodes, setNodes, setEdges, fitView]
  );

  // ── Progressive code analysis ─────────────────────────────────────────────
  const analysisRan = useRef(false);

  useEffect(() => {
    if (analysisRan.current || allFileNodes.length === 0 || !branch) return;
    analysisRan.current = true;

    const allFilePaths = allFileNodes.map((n) => n.id);

    async function runAnalysis() {
      setAnalysisLoading(true);

      const contentsMap = new Map<string, string>();
      const newSymbolsMap = new Map<string, FileSymbols>();

      const BATCH = 12;
      for (let i = 0; i < allFilePaths.length; i += BATCH) {
        const batch = allFilePaths.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (filePath) => {
            try {
              const url = `/repos/${owner}/${repo}/${branch}/${filePath}`;
              const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
              if (!res.ok) return;
              const text = await res.text();
              contentsMap.set(filePath, text);
              newSymbolsMap.set(filePath, parseSymbols(filePath, text));
            } catch {
              // skip files that fail to fetch
            }
          })
        );
      }
      // Single state update after all batches — avoids per-batch re-renders
      setSymbolsMap(new Map(newSymbolsMap));

      const relationships = findRelationships(newSymbolsMap, allFilePaths, contentsMap);

      const analysisEdges: Edge[] = relationships.map((rel, idx) => ({
        id: `analysis-${idx}-${rel.type}-${rel.source}-${rel.target}`,
        source: rel.source,
        target: rel.target,
        type: 'default',
        style: {
          stroke: RELATIONSHIP_COLORS[rel.type],
          strokeWidth: rel.type === 'calls' ? 1 : 1.5,
          strokeDasharray: EDGE_DASH[rel.type],
          opacity: 0.7,
        },
        animated: rel.type === 'calls',
        label: rel.symbols.slice(0, 2).join(', '),
        labelStyle: {
          fill: RELATIONSHIP_COLORS[rel.type],
          fontSize: 7,
          fontFamily: 'monospace',
        },
        labelBgStyle: { fill: '#0d0d0d', fillOpacity: 0.7 },
        data: { relType: rel.type, symbols: rel.symbols },
      }));

      const newFileEdges = [
        ...allFileEdges.filter((e) => !e.id.startsWith('analysis-')),
        ...analysisEdges,
      ];
      fileEdgesRef.current = newFileEdges;

      // Rebuild whatever view is currently active
      if (prevChapterRef.current) {
        const entry = chapterMapEntries?.find((c) => c.id === prevChapterRef.current);
        const { nodes: n, edges: e } = buildChapterView(
          allFileNodes,
          newFileEdges,
          entry?.files ?? [],
          entry?.graph
        );
        setNodes(n as Node[]);
        setEdges(e);
      } else {
        const { nodes: n, edges: e } = buildCwdView(allFileNodes, newFileEdges, cwdRef.current);
        setNodes(n as Node[]);
        setEdges(e);
      }

      setAnalysisLoading(false);
    }

    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFileNodes, allFileEdges, owner, repo, branch]);

  // ── Node interaction ──────────────────────────────────────────────────────

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type === 'folderNode') {
        const data = node.data as FolderNodeData;
        setCenter(
          node.position.x + FOLDER_NODE_WIDTH / 2,
          node.position.y + FOLDER_NODE_HEIGHT / 2,
          { zoom: 1.4, duration: 380 }
        );
        setTimeout(() => navigateToCwd(data.folderPath), 420);
        return;
      }
      setSelectedFilePath(node.id);
      fitView({ nodes: [{ id: node.id }], padding: 0.35, duration: 600, maxZoom: 2.5 });
    },
    [fitView, setCenter, navigateToCwd]
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type === 'fileNode') onEnterFile(node.id);
    },
    [onEnterFile]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedFilePath(null);
  }, []);

  const handleEnterEditor = useCallback(() => {
    if (selectedFilePath) onEnterFile(selectedFilePath);
  }, [selectedFilePath, onEnterFile]);

  const ctxValue = useMemo(
    () => ({ owner, repo, branch, selectedFilePath, symbolsMap, analysisLoading }),
    [owner, repo, branch, selectedFilePath, symbolsMap, analysisLoading]
  );

  return (
    <GraphContext.Provider value={ctxValue}>
      <Breadcrumb cwd={cwd} activeChapterId={activeChapterId} onNavigate={navigateToCwd} />
      {activeChapterId && <ChapterHint activeChapterId={activeChapterId} />}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ animated: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#222"
          style={{ background: '#0d0d0d' }}
        />
        <ZoomWatcher selectedFilePath={selectedFilePath} onEnterFile={onEnterFile} />
        <GraphControls selectedFilePath={selectedFilePath} onEnterEditor={handleEnterEditor} />
        <GraphLegend analysisLoading={analysisLoading} />
      </ReactFlow>
    </GraphContext.Provider>
  );
}

// ─── GraphExplorer ────────────────────────────────────────────────────────────

interface GraphExplorerProps {
  owner: string;
  repo: string;
  onEnterFile: (filePath: string) => void;
  activeChapterId?: string | null;
  chapterMapEntries?: ChapterMapEntry[];
}

export function GraphExplorer({
  owner,
  repo,
  onEnterFile,
  activeChapterId,
  chapterMapEntries,
}: GraphExplorerProps) {
  const guideDoc = useMemo(() => getGuideByRepo(owner, repo), [owner, repo]);
  const projectConfig = useMemo(() => getProjectConfig(owner, repo), [owner, repo]);
  const branch = projectConfig?.defaultBranch ?? 'main';

  const { nodes: allFileNodes, edges: allFileEdges } = useMemo(() => {
    if (!guideDoc) return { nodes: [] as Node<FileNodeData>[], edges: [] as Edge[] };
    return buildGraphData(guideDoc.content);
  }, [guideDoc]);

  if (allFileNodes.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0d0d0d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#444',
          fontFamily: 'monospace',
          fontSize: 13,
        }}
      >
        No file map available for this repository.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0d0d0d', position: 'relative' }}>
      <ReactFlowProvider>
        <GraphFlow
          owner={owner}
          repo={repo}
          branch={branch}
          allFileNodes={allFileNodes}
          allFileEdges={allFileEdges}
          activeChapterId={activeChapterId}
          chapterMapEntries={chapterMapEntries}
          onEnterFile={onEnterFile}
        />
      </ReactFlowProvider>
    </div>
  );
}

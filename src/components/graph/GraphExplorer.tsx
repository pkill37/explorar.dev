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
import { PairedNode } from './PairedNode';
import { GraphControls } from './GraphControls';
import { CodeIntelPanel } from './CodeIntelPanel';
import { ZoomWatcher } from './ZoomWatcher';
import { GraphLegend } from './GraphLegend';
import {
  buildGraphData,
  buildGraphDataFromSections,
  buildCwdView,
  buildChapterView,
  projectEdgesForCwd,
  FOLDER_NODE_WIDTH,
  FOLDER_NODE_HEIGHT,
  type FileNodeData,
  type FolderNodeData,
  type PairedNodeData,
} from '@/lib/graph-data';
import {
  parseSymbols,
  findRelationships,
  RELATIONSHIP_COLORS,
  type FileSymbols,
} from '@/lib/code-analysis';
import { fetchRepositoryFile } from '@/lib/github-api';
import { getGuideByRepo } from '@/lib/guides/docs-loader';
import { getProjectConfig, type GuideSection } from '@/lib/project-guides';
import { GraphContext } from '@/contexts/GraphContext';
import {
  buildImportedEdges,
  findQueryMatchedNodeIds,
  getNodeEvidenceSummary,
  getSelectedNodePaths,
  loadOpenCodeIntelBundle,
  parseOpenCodeIntel,
  saveOpenCodeIntelBundle,
  type OpenCodeIntelBundle,
} from '@/lib/open-code-intel';

// Defined at module scope to avoid ReactFlow "nodeTypes changed" warnings
const nodeTypes: NodeTypes = {
  fileNode: FileNode as NodeTypes['fileNode'],
  folderNode: FolderNode as NodeTypes['folderNode'],
  pairedNode: PairedNode as NodeTypes['pairedNode'],
};

const EDGE_DASH: Record<string, string | undefined> = {
  includes: undefined,
  imports: undefined,
  calls: '5 3',
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
      <span style={{ color: '#808080' }}>chapter ·</span>
      <span style={{ color: '#999' }}>{title}</span>
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

  // Analysis edges are computed incrementally and merged with guide/imported edges.
  const analysisEdgesRef = useRef<Edge[]>([]);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [symbolsMap, setSymbolsMap] = useState<Map<string, FileSymbols>>(new Map());
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [codeIntelBundle, setCodeIntelBundle] = useState<OpenCodeIntelBundle | null>(null);
  const [graphQuery, setGraphQuery] = useState('');
  const [matchedNodeIds, setMatchedNodeIds] = useState<string[]>([]);

  // ── Initial view: root depth=1 (no chapter active) ───────────────────────
  const initialView = useMemo(
    () => buildCwdView(allFileNodes, allFileEdges, ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialView.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialView.edges);
  const knownFilePathSet = useMemo(
    () => new Set(allFileNodes.map((node) => node.id)),
    [allFileNodes]
  );
  const importedEdges = useMemo(
    () =>
      codeIntelBundle
        ? buildImportedEdges(codeIntelBundle).filter(
            (edge) => knownFilePathSet.has(edge.source) && knownFilePathSet.has(edge.target)
          )
        : [],
    [codeIntelBundle, knownFilePathSet]
  );

  const getEffectiveFileEdges = useCallback(
    () => [
      ...allFileEdges.filter(
        (edge) => !edge.id.startsWith('analysis-') && !edge.id.startsWith('imported-')
      ),
      ...analysisEdgesRef.current,
      ...importedEdges,
    ],
    [allFileEdges, importedEdges]
  );

  const rebuildCurrentView = useCallback(() => {
    const effectiveEdges = getEffectiveFileEdges();

    if (!prevChapterRef.current) {
      const { nodes: nextNodes, edges: nextEdges } = buildCwdView(
        allFileNodes,
        effectiveEdges,
        cwdRef.current
      );
      setNodes(nextNodes as Node[]);
      setEdges(nextEdges);
      return;
    }

    const entry = chapterMapEntries?.find((chapter) => chapter.id === prevChapterRef.current);
    const { nodes: nextNodes, edges: nextEdges } = buildChapterView(
      allFileNodes,
      effectiveEdges,
      entry?.files ?? [],
      entry?.graph
    );
    setNodes(nextNodes as Node[]);
    setEdges(nextEdges);
  }, [allFileNodes, chapterMapEntries, getEffectiveFileEdges, setEdges, setNodes]);

  useEffect(() => {
    setCodeIntelBundle(loadOpenCodeIntelBundle(owner, repo, branch));
  }, [owner, repo, branch]);

  useEffect(() => {
    saveOpenCodeIntelBundle(owner, repo, branch, codeIntelBundle);
    rebuildCurrentView();
  }, [owner, repo, branch, codeIntelBundle, rebuildCurrentView]);

  // ── React to chapter change ───────────────────────────────────────────────
  const prevChapterRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevChapterRef.current === activeChapterId) return;
    console.log(`[GraphFlow] chapter changed: "${prevChapterRef.current}" → "${activeChapterId}"`);
    prevChapterRef.current = activeChapterId;

    setSelectedFilePath(null);

    if (!activeChapterId) {
      // No active chapter → return to cwd view
      const { nodes: n, edges: e } = buildCwdView(
        allFileNodes,
        getEffectiveFileEdges(),
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
        getEffectiveFileEdges(),
        entry?.files ?? [],
        entry?.graph
      );
      setNodes(n as Node[]);
      setEdges(e);
    }
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [
    activeChapterId,
    allFileNodes,
    chapterMapEntries,
    getEffectiveFileEdges,
    setEdges,
    setNodes,
    fitView,
  ]);

  // ── Navigate to a new cwd (only valid outside chapter view) ──────────────
  const navigateToCwd = useCallback(
    (newCwd: string) => {
      console.log(`[GraphFlow] navigateToCwd → "${newCwd || 'root'}"`);
      setCwd(newCwd);
      const { nodes: n, edges: e } = buildCwdView(allFileNodes, getEffectiveFileEdges(), newCwd);
      setNodes(n as Node[]);
      setEdges(e);
      setSelectedFilePath(null);
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
    },
    [allFileNodes, getEffectiveFileEdges, setNodes, setEdges, fitView]
  );

  // ── Progressive code analysis ─────────────────────────────────────────────
  const analysisRan = useRef(false);

  useEffect(() => {
    if (analysisRan.current || allFileNodes.length === 0 || !branch) return;
    analysisRan.current = true;

    const allFilePaths = allFileNodes.map((n) => n.id);

    async function runAnalysis() {
      console.log(`[GraphFlow] runAnalysis start: ${allFilePaths.length} files to fetch`);
      console.time('[GraphFlow] runAnalysis total');
      setAnalysisLoading(true);

      const contentsMap = new Map<string, string>();
      const newSymbolsMap = new Map<string, FileSymbols>();

      // Yield to the browser between batches so the UI stays responsive.
      const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

      // Declarations (#include, function signatures) are always near the top of a file.
      // Truncating to 60 KB gives complete symbol coverage while cutting fetch + regex time
      // dramatically for large files like unicodeobject.c (500 KB) or typeobject.c (250 KB).
      const ANALYSIS_MAX_BYTES = 60 * 1024;

      const BATCH = 12;
      console.time('[GraphFlow] fetch all batches');
      for (let i = 0; i < allFilePaths.length; i += BATCH) {
        const batch = allFilePaths.slice(i, i + BATCH);
        const batchLabel = `[GraphFlow] fetch batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(allFilePaths.length / BATCH)} (files ${i}–${Math.min(i + BATCH, allFilePaths.length) - 1})`;
        console.time(batchLabel);
        await Promise.all(
          batch.map(async (filePath) => {
            try {
              const fullText = (await fetchRepositoryFile(owner, repo, branch, filePath)).content;
              const text =
                fullText.length > ANALYSIS_MAX_BYTES
                  ? fullText.slice(0, ANALYSIS_MAX_BYTES)
                  : fullText;
              if (fullText.length > ANALYSIS_MAX_BYTES) {
                console.log(
                  `[GraphFlow] truncated ${filePath}: ${Math.round(fullText.length / 1024)}KB → 60KB`
                );
              }
              contentsMap.set(filePath, text);
              newSymbolsMap.set(filePath, parseSymbols(filePath, text));
            } catch (err) {
              console.warn(`[GraphFlow] fetch error: ${filePath}`, err);
            }
          })
        );
        console.timeEnd(batchLabel);
        // Yield after each batch so React can process events / paint between fetches
        await yieldToMain();
      }
      console.timeEnd('[GraphFlow] fetch all batches');
      console.log(
        `[GraphFlow] fetched ${contentsMap.size}/${allFilePaths.length} files, parsed ${newSymbolsMap.size} symbol maps`
      );
      // Single state update after all batches — avoids per-batch re-renders
      setSymbolsMap(new Map(newSymbolsMap));

      // Yield before the O(n×m) relationship pass so the symbolsMap update can render
      await yieldToMain();

      console.time('[GraphFlow] findRelationships');
      const relationships = findRelationships(newSymbolsMap, allFilePaths, contentsMap);
      console.timeEnd('[GraphFlow] findRelationships');
      console.log(`[GraphFlow] found ${relationships.length} relationships`);

      // Yield again after the heavy synchronous computation before touching React state
      await yieldToMain();

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

      analysisEdgesRef.current = analysisEdges;
      const newFileEdges = getEffectiveFileEdges();

      // Update edges only — nodes already have correct positions from initial Dagre layout.
      // This avoids a full rebuild (including another Dagre pass) after analysis completes.
      if (!prevChapterRef.current) {
        console.time('[GraphFlow] projectEdgesForCwd');
        const projectedEdges = projectEdgesForCwd(allFileNodes, newFileEdges, cwdRef.current);
        console.timeEnd('[GraphFlow] projectEdgesForCwd');
        console.log(
          `[GraphFlow] projected ${projectedEdges.length} edges for cwd="${cwdRef.current || 'root'}"`
        );
        setEdges(projectedEdges);
      }
      // Chapter view: curated edges are static and don't need updating after analysis.

      setAnalysisLoading(false);
      console.timeEnd('[GraphFlow] runAnalysis total');
    }

    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFileNodes, allFileEdges, owner, repo, branch, getEffectiveFileEdges]);

  const selectedPaths = useMemo(
    () =>
      getSelectedNodePaths(
        selectedFilePath,
        nodes as Array<Node<FileNodeData | FolderNodeData | PairedNodeData>>
      ),
    [selectedFilePath, nodes]
  );

  const selectedEvidence = useMemo(
    () => getNodeEvidenceSummary(selectedPaths, codeIntelBundle, edges),
    [selectedPaths, codeIntelBundle, edges]
  );

  const displayNodes = useMemo(() => {
    const matchedSet = new Set(matchedNodeIds);
    const hasQueryMatches = matchedSet.size > 0;

    return nodes.map((node) => {
      if (!hasQueryMatches) {
        return node;
      }

      const isMatched = matchedSet.has(node.id);
      return {
        ...node,
        style: {
          ...(node.style ?? {}),
          opacity: isMatched ? 1 : 0.28,
          boxShadow: isMatched ? '0 0 0 2px rgba(251,191,36,0.9)' : undefined,
        },
      };
    });
  }, [nodes, matchedNodeIds]);

  const handleImportBundle = useCallback(
    (raw: string) => {
      const bundle = parseOpenCodeIntel(raw, repo);
      setCodeIntelBundle(bundle);
    },
    [repo]
  );

  const handleClearBundle = useCallback(() => {
    setCodeIntelBundle(null);
    setMatchedNodeIds([]);
  }, []);

  const handleFocusQuery = useCallback(() => {
    const matches = findQueryMatchedNodeIds(
      graphQuery,
      nodes as Array<Node<FileNodeData | FolderNodeData | PairedNodeData>>,
      codeIntelBundle
    );
    setMatchedNodeIds(matches);
    if (matches.length > 0) {
      fitView({
        nodes: matches.map((id) => ({ id })),
        padding: 0.28,
        duration: 480,
        maxZoom: 2.4,
      });
    }
  }, [codeIntelBundle, fitView, graphQuery, nodes]);

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
      if (node.type === 'fileNode' || node.type === 'pairedNode') onEnterFile(node.id);
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
        nodes={displayNodes}
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
        <CodeIntelPanel
          bundle={codeIntelBundle}
          selectedNodeId={selectedFilePath}
          selectedPaths={selectedPaths}
          selectedEvidence={selectedEvidence}
          query={graphQuery}
          queryMatchCount={matchedNodeIds.length}
          onQueryChange={setGraphQuery}
          onFocusQuery={handleFocusQuery}
          onImportBundle={handleImportBundle}
          onClearBundle={handleClearBundle}
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
  guideSections?: GuideSection[];
}

export function GraphExplorer({
  owner,
  repo,
  onEnterFile,
  activeChapterId,
  chapterMapEntries,
  guideSections,
}: GraphExplorerProps) {
  const guideDoc = useMemo(() => getGuideByRepo(owner, repo), [owner, repo]);
  const projectConfig = useMemo(() => getProjectConfig(owner, repo), [owner, repo]);
  const branch = projectConfig?.defaultRevision ?? 'main';

  const { nodes: allFileNodes, edges: allFileEdges } = useMemo(() => {
    if (guideSections && guideSections.length > 0) {
      console.log(`[GraphExplorer] building graph from parsed guide sections for ${owner}/${repo}`);
      const result = buildGraphDataFromSections(guideSections, { includeDocs: true });
      console.log(`[GraphExplorer] graph built: ${result.nodes.length} nodes`);
      return result;
    }
    if (!guideDoc) return { nodes: [] as Node<FileNodeData>[], edges: [] as Edge[] };
    console.log(`[GraphExplorer] building graph for ${owner}/${repo}`);
    const result = buildGraphData(guideDoc.content);
    console.log(`[GraphExplorer] graph built: ${result.nodes.length} nodes`);
    return result;
  }, [guideDoc, guideSections, owner, repo]);

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

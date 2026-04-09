import Dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

export interface FolderNodeData extends Record<string, unknown> {
  folderName: string;
  folderPath: string; // full path from root (e.g. 'kernel/sched')
  fileCount: number;
  color: string; // dominant section color
  filePaths: string[]; // file node IDs in this folder
}

export const FOLDER_NODE_WIDTH = 200;
export const FOLDER_NODE_HEIGHT = 120;

export interface FileNodeData extends Record<string, unknown> {
  filePath: string;
  fileName: string;
  language: string;
  sectionLabel: string;
  sectionIndex: number;
  color: string;
}

export const NODE_WIDTH = 300;
export const NODE_HEIGHT = 180;

export interface PairedNodeData extends Record<string, unknown> {
  primaryPath: string; // .c file
  headerPath: string; // .h file
  primaryName: string;
  headerName: string;
  language: string;
  sectionLabel: string;
  sectionIndex: number;
  color: string;
}

/**
 * Merge paired .c/.h nodes (same base stem) into a single PairedNode.
 * Edges that referenced either individual node are remapped to the paired id.
 * Intra-pair edges are dropped.
 */
function mergeCHPairs(
  nodes: Node<FileNodeData>[],
  edges: Edge[]
): { nodes: Node<FileNodeData | PairedNodeData>[]; edges: Edge[] } {
  const cNodes = nodes.filter((n) => /\.c$/i.test(n.data.filePath));
  const hNodes = nodes.filter((n) => /\.h$/i.test(n.data.filePath));

  const pairedIds = new Set<string>();
  const idRemap = new Map<string, string>(); // old id → paired node id
  const pairedNodes: Node<PairedNodeData>[] = [];

  for (const cNode of cNodes) {
    if (pairedIds.has(cNode.id)) continue;
    const cStem = cNode.data.fileName.replace(/\.c$/i, '').toLowerCase();

    const hNode = hNodes.find((h) => {
      if (pairedIds.has(h.id)) return false;
      return h.data.fileName.replace(/\.h$/i, '').toLowerCase() === cStem;
    });
    if (!hNode) continue;

    pairedIds.add(cNode.id);
    pairedIds.add(hNode.id);

    const pairedId = `${cNode.id}|||${hNode.id}`;
    idRemap.set(cNode.id, pairedId);
    idRemap.set(hNode.id, pairedId);

    pairedNodes.push({
      id: pairedId,
      type: 'pairedNode',
      position: { x: 0, y: 0 },
      data: {
        primaryPath: cNode.data.filePath,
        headerPath: hNode.data.filePath,
        primaryName: cNode.data.fileName,
        headerName: hNode.data.fileName,
        language: 'c',
        sectionLabel: cNode.data.sectionLabel,
        sectionIndex: cNode.data.sectionIndex,
        color: cNode.data.color,
      },
    });
  }

  if (pairedNodes.length === 0) return { nodes, edges };

  const unpairedNodes = nodes.filter((n) => !pairedIds.has(n.id));
  const outputNodes: Node<FileNodeData | PairedNodeData>[] = [...unpairedNodes, ...pairedNodes];

  const seenKeys = new Set<string>();
  const outputEdges: Edge[] = [];
  for (const edge of edges) {
    const src = idRemap.get(edge.source) ?? edge.source;
    const tgt = idRemap.get(edge.target) ?? edge.target;
    if (src === tgt) continue;
    const key = `${src}|||${tgt}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    outputEdges.push({ ...edge, id: `${edge.id}-m`, source: src, target: tgt });
  }

  return { nodes: outputNodes, edges: outputEdges };
}

const SECTION_COLORS = [
  '#1d4ed8', // blue
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#db2777', // pink
  '#0891b2', // cyan
  '#65a30d', // lime
  '#dc2626', // red
];

function getLang(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    c: 'c',
    h: 'c',
    cc: 'cpp',
    cpp: 'cpp',
    cxx: 'cpp',
    py: 'python',
    rs: 'rust',
    js: 'javascript',
    ts: 'typescript',
    tsx: 'tsx',
    rst: 'rst',
    md: 'markdown',
    s: 'asm',
    go: 'go',
    java: 'java',
    rb: 'ruby',
    sh: 'bash',
  };
  return map[ext] ?? 'text';
}

// ─── Core-file filtering ─────────────────────────────────────────────────────

/** Extensions that represent actual source / compiled artefacts worth studying */
const CORE_EXTENSIONS = new Set([
  'c',
  'h',
  'cc',
  'cpp',
  'cxx',
  'hh',
  'hpp', // C / C++
  'py',
  'pyx',
  'pxd', // Python / Cython
  'rs', // Rust
  'go', // Go
  'java',
  'kt',
  'scala', // JVM
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'cjs', // JS / TS
  'rb', // Ruby
  'swift',
  'm',
  'mm', // Apple
  'cs', // C#
  's',
  'asm',
  'S', // Assembly
  'lua',
  'pl',
  'php',
  'ex',
  'exs', // Scripting
  'zig',
  'nim',
  'odin', // Systems
  'json',
  'toml',
  'yaml',
  'yml', // Config / schema (sparingly)
  'mk',
  'cmake', // Build files
]);

/** Path segments that indicate documentation / example / test trees */
const NON_CORE_DIR_RE =
  /(?:^|\/)(?:doc|docs|documentation|man|manpages|manual|manuals|help|book|books|tutorial|tutorials|guide|guides|example|examples|sample|samples|demo|demos|test|tests|testing|spec|specs|bench|benchmarks|benchmark|t|xt|fixtures)\//i;

/** Filenames that are documentation regardless of location */
const DOC_FILENAME_RE =
  /^(?:readme|changelog|changes|contributing|contributors|authors|copying|license|licence|notice|todo|notes|credits|history|install|installation|faq|makefile\.doc|codeofconduct|code_of_conduct|security)(?:\..+)?$/i;

/** Extensions that are purely documentation / markup */
const DOC_EXTENSIONS = new Set([
  'md',
  'rst',
  'txt',
  'adoc',
  'asciidoc',
  'texi',
  'texinfo',
  'html',
  'htm',
  'xml',
  'pdf',
  'doc',
  'docx',
  'odt',
]);

function isCoreSourceFile(filePath: string): boolean {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  // Reject non-files and http links
  if (!fileName.includes('.') || filePath.startsWith('http') || filePath.startsWith('#')) {
    return false;
  }

  // Reject images / fonts / binary artefacts
  if (
    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|so|a|o|pyc|class|jar|bin|exe|dll)$/i.test(
      fileName
    )
  ) {
    return false;
  }

  // Reject pure doc extensions
  if (DOC_EXTENSIONS.has(ext)) return false;

  // Reject known doc filenames
  if (DOC_FILENAME_RE.test(fileName)) return false;

  // Reject doc / test / example directory trees
  const pathWithSlash = '/' + filePath;
  if (NON_CORE_DIR_RE.test(pathWithSlash)) return false;

  // Must be a recognised source extension (or a build config)
  return CORE_EXTENSIONS.has(ext);
}

function isFilePath(path: string): boolean {
  const last = path.split('/').pop() ?? '';
  return (
    last.includes('.') &&
    !path.startsWith('http') &&
    !path.startsWith('#') &&
    last.length > 2 &&
    !/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(last)
  );
}

export function buildGraphData(guideContent: string): {
  nodes: Node<FileNodeData>[];
  edges: Edge[];
} {
  console.time('[graph-data] buildGraphData total');
  const files: Array<{ filePath: string; sectionLabel: string; sectionIndex: number }> = [];
  const seen = new Set<string>();

  const lines = guideContent.split('\n');
  let sectionLabel = 'Overview';
  let sectionIndex = 0;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      sectionLabel = h2[1].replace(/^Chapter\s+\d+\s*[—\-–]\s*/, '').trim();
      sectionIndex++;
      continue;
    }

    // Markdown links: [text](path)
    const linkRe = /\[([^\]]+)\]\(([^)#\s]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(line)) !== null) {
      const p = m[2];
      if (isFilePath(p) && isCoreSourceFile(p) && !seen.has(p)) {
        seen.add(p);
        files.push({ filePath: p, sectionLabel, sectionIndex });
      }
    }

    // Backtick paths with directory separator: `kernel/fork.c`
    const btRe = /`([a-zA-Z0-9_./-]+\/[a-zA-Z0-9_./-]+\.[a-zA-Z]{1,4})`/g;
    while ((m = btRe.exec(line)) !== null) {
      const p = m[1];
      if (isFilePath(p) && isCoreSourceFile(p) && !seen.has(p)) {
        seen.add(p);
        files.push({ filePath: p, sectionLabel, sectionIndex });
      }
    }
  }

  console.log(`[graph-data] parsed ${files.length} file refs from guide`);
  // Cap at 60 nodes (more headroom now that doc files are filtered out)
  const limited = files.slice(0, 60);

  // Group by section
  const bySection = new Map<string, typeof limited>();
  for (const f of limited) {
    if (!bySection.has(f.sectionLabel)) bySection.set(f.sectionLabel, []);
    bySection.get(f.sectionLabel)!.push(f);
  }

  // Assign colors per top-level directory (files in the same folder share a color)
  const folderColorMap = new Map<string, string>();
  let ci = 0;
  for (const f of limited) {
    const folder = f.filePath.includes('/') ? f.filePath.split('/')[0] : '';
    if (!folderColorMap.has(folder)) {
      folderColorMap.set(folder, SECTION_COLORS[ci % SECTION_COLORS.length]);
      ci++;
    }
  }

  const nodes: Node<FileNodeData>[] = [];
  const edges: Edge[] = [];

  for (const f of limited) {
    const folder = f.filePath.includes('/') ? f.filePath.split('/')[0] : '';
    const color = folderColorMap.get(folder) ?? '#1d4ed8';
    nodes.push({
      id: f.filePath,
      type: 'fileNode',
      position: { x: 0, y: 0 }, // dagre will set this
      data: {
        filePath: f.filePath,
        fileName: f.filePath.split('/').pop() ?? f.filePath,
        language: getLang(f.filePath),
        sectionLabel: f.sectionLabel,
        sectionIndex: f.sectionIndex,
        color,
      },
    });
  }

  // Edges within sections (connect consecutive files)
  for (const [, sf] of bySection) {
    const folder = sf[0].filePath.includes('/') ? sf[0].filePath.split('/')[0] : '';
    const color = folderColorMap.get(folder) ?? '#1d4ed8';
    for (let i = 0; i < sf.length - 1; i++) {
      edges.push({
        id: `e-${sf[i].filePath}→${sf[i + 1].filePath}`,
        source: sf[i].filePath,
        target: sf[i + 1].filePath,
        type: 'smoothstep',
        style: { stroke: color, strokeOpacity: 0.35, strokeWidth: 1.5 },
      });
    }
  }

  // Dagre layout
  console.time('[graph-data] dagre layout');
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 55, ranksep: 130, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  Dagre.layout(g);
  console.timeEnd('[graph-data] dagre layout');

  for (const node of nodes) {
    const n = g.node(node.id);
    if (n) {
      node.position = { x: n.x - NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 };
    }
  }

  console.log(`[graph-data] buildGraphData → ${nodes.length} nodes, ${edges.length} edges`);
  console.timeEnd('[graph-data] buildGraphData total');
  return { nodes, edges };
}

// ─── CWD-based depth=1 view ───────────────────────────────────────────────────

/**
 * Builds a depth=1 graph view for the given `cwd` (current working directory).
 *
 * - Files directly inside `cwd` appear as FileNodes.
 * - Subdirectories of `cwd` are collapsed into FolderNodes.
 * - Guide/analysis edges are projected onto the depth=1 representatives so that
 *   pedagogically relevant connections remain visible at every navigation level.
 *
 * Pass `cwd = ''` for the root view.
 */
export function buildCwdView(
  allFileNodes: Node<FileNodeData>[],
  allFileEdges: Edge[],
  cwd: string
): { nodes: Node<FileNodeData | FolderNodeData | PairedNodeData>[]; edges: Edge[] } {
  const label = `[graph-data] buildCwdView(cwd="${cwd || 'root'}")`;
  console.time(label);
  // Determine which files are under this cwd
  const filesUnderCwd = allFileNodes.filter((node) => {
    if (cwd === '') return true;
    return node.data.filePath.startsWith(cwd + '/');
  });

  const folderMap = new Map<string, Node<FileNodeData>[]>(); // subdir name → files
  const directFiles: Node<FileNodeData>[] = [];

  for (const node of filesUnderCwd) {
    const relPath = cwd === '' ? node.data.filePath : node.data.filePath.slice(cwd.length + 1);
    const firstSlash = relPath.indexOf('/');
    if (firstSlash === -1) {
      directFiles.push(node);
    } else {
      const subdir = relPath.slice(0, firstSlash);
      if (!folderMap.has(subdir)) folderMap.set(subdir, []);
      folderMap.get(subdir)!.push(node);
    }
  }

  const outputNodes: Node<FileNodeData | FolderNodeData>[] = [];

  // Build FolderNodes for subdirectories
  for (const [subdir, files] of folderMap) {
    const folderPath = cwd === '' ? subdir : `${cwd}/${subdir}`;
    const colorCount = new Map<string, number>();
    for (const f of files) {
      colorCount.set(f.data.color, (colorCount.get(f.data.color) ?? 0) + 1);
    }
    const color = [...colorCount.entries()].sort((a, b) => b[1] - a[1])[0][0];

    outputNodes.push({
      id: `folder:${folderPath}`,
      type: 'folderNode',
      position: { x: 0, y: 0 },
      data: {
        folderName: subdir,
        folderPath,
        fileCount: files.length,
        color,
        filePaths: files.map((f) => f.id),
      },
    });
  }

  // Include direct FileNodes (re-use the original node data, reset position for layout)
  for (const file of directFiles) {
    outputNodes.push({ ...file, position: { x: 0, y: 0 } });
  }

  // Project edges to depth=1 representatives
  // Returns the ID of the depth=1 node for a given filePath, or null if not in cwd
  function getRepresentative(filePath: string): string | null {
    if (cwd !== '' && !filePath.startsWith(cwd + '/')) return null;
    const relPath = cwd === '' ? filePath : filePath.slice(cwd.length + 1);
    const firstSlash = relPath.indexOf('/');
    if (firstSlash === -1) return filePath; // direct file
    const subdir = relPath.slice(0, firstSlash);
    const folderPath = cwd === '' ? subdir : `${cwd}/${subdir}`;
    return `folder:${folderPath}`;
  }

  // Aggregate edges, deduplicate by representative pair
  const edgeAgg = new Map<
    string,
    { source: string; target: string; color: string; count: number }
  >();

  for (const edge of allFileEdges) {
    const srcRep = getRepresentative(edge.source);
    const tgtRep = getRepresentative(edge.target);
    if (!srcRep || !tgtRep || srcRep === tgtRep) continue;
    const key = `${srcRep}|||${tgtRep}`;
    if (!edgeAgg.has(key)) {
      const color = allFileNodes.find((n) => n.id === edge.source)?.data.color ?? '#555';
      edgeAgg.set(key, { source: srcRep, target: tgtRep, color, count: 0 });
    }
    edgeAgg.get(key)!.count++;
  }

  const rawEdges: Edge[] = [...edgeAgg.values()].map(({ source, target, color, count }) => ({
    id: `cwd|||${source}|||${target}`,
    source,
    target,
    type: 'smoothstep',
    style: {
      stroke: color,
      strokeOpacity: 0.6,
      strokeWidth: Math.min(1 + count * 0.3, 3.5),
    },
  }));

  // Merge .c/.h pairs among direct file nodes (folders stay as-is)
  const fileNodesOnly = outputNodes.filter((n) => n.type === 'fileNode') as Node<FileNodeData>[];
  const nonFileNodes = outputNodes.filter((n) => n.type !== 'fileNode');
  const { nodes: mergedFileNodes, edges: mergedEdges } = mergeCHPairs(fileNodesOnly, rawEdges);
  const finalNodes = [...nonFileNodes, ...mergedFileNodes] as Node<
    FileNodeData | FolderNodeData | PairedNodeData
  >[];

  // Dagre layout
  console.log(
    `[graph-data] buildCwdView → ${finalNodes.length} nodes, ${mergedEdges.length} edges`
  );
  console.time('[graph-data] buildCwdView dagre');
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 150, marginx: 40, marginy: 40 });

  for (const node of finalNodes) {
    const w = node.type === 'folderNode' ? FOLDER_NODE_WIDTH : NODE_WIDTH;
    const h = node.type === 'folderNode' ? FOLDER_NODE_HEIGHT : NODE_HEIGHT;
    g.setNode(node.id, { width: w, height: h });
  }
  for (const edge of mergedEdges) {
    g.setEdge(edge.source, edge.target);
  }

  Dagre.layout(g);
  console.timeEnd('[graph-data] buildCwdView dagre');

  for (const node of finalNodes) {
    const n = g.node(node.id);
    if (n) {
      const w = node.type === 'folderNode' ? FOLDER_NODE_WIDTH : NODE_WIDTH;
      const h = node.type === 'folderNode' ? FOLDER_NODE_HEIGHT : NODE_HEIGHT;
      node.position = { x: n.x - w / 2, y: n.y - h / 2 };
    }
  }

  console.timeEnd(label);
  return { nodes: finalNodes, edges: mergedEdges };
}

// ─── Per-chapter view ─────────────────────────────────────────────────────────

interface ParsedChapterEdge {
  source: string;
  target: string;
  label?: string;
}

/**
 * Parses the edge-list format used in `chapter-graph` fenced blocks.
 *
 * Each non-blank, non-comment line is expected to have the shape:
 *   source/path.c -> target/path.c
 *   source/path.c -> target/path.c : human-readable label
 */
function parseChapterEdges(graphDef: string): ParsedChapterEdge[] {
  const edges: ParsedChapterEdge[] = [];
  for (const raw of graphDef.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(.+?)\s*->\s*(.+?)(?:\s*:\s*(.+))?$/);
    if (m) {
      edges.push({ source: m[1].trim(), target: m[2].trim(), label: m[3]?.trim() });
    }
  }
  return edges;
}

/**
 * Builds a per-chapter ReactFlow graph.
 *
 * - `chapterFiles` is the authoritative list of file paths for this chapter
 *   (from `fileRecommendations.source` in the guide frontmatter).
 * - Adds any nodes referenced by the curated `chapter-graph` edge list.
 * - Uses curated edges if provided; otherwise falls back to guide edges
 *   between chapter nodes.
 * - Lays out with Dagre (LR direction).
 */
export function buildChapterView(
  allFileNodes: Node<FileNodeData>[],
  allFileEdges: Edge[],
  chapterFiles: string[],
  chapterGraphDef?: string
): { nodes: Node<FileNodeData | PairedNodeData>[]; edges: Edge[] } {
  console.time('[graph-data] buildChapterView');
  const parsedEdges = chapterGraphDef ? parseChapterEdges(chapterGraphDef) : [];

  // Collect all needed file paths: explicit chapter files + edge endpoints
  const needed = new Set<string>(chapterFiles);
  for (const e of parsedEdges) {
    needed.add(e.source);
    needed.add(e.target);
  }

  // If nothing was specified, fall back to all file nodes (avoids empty graph)
  if (needed.size === 0) {
    for (const n of allFileNodes) needed.add(n.id);
  }

  // chapterNodes: subset of allFileNodes that are in the needed set
  const chapterNodes = allFileNodes.filter((n) => needed.has(n.id));

  // Build node map: prefer existing nodes, create minimal stubs for edge-only references
  const nodeMap = new Map<string, Node<FileNodeData>>();
  for (const node of allFileNodes) {
    if (needed.has(node.id)) {
      nodeMap.set(node.id, { ...node, position: { x: 0, y: 0 } });
    }
  }

  const fallbackColor = chapterNodes[0]?.data.color ?? SECTION_COLORS[0];
  for (const path of needed) {
    if (!nodeMap.has(path)) {
      nodeMap.set(path, {
        id: path,
        type: 'fileNode',
        position: { x: 0, y: 0 },
        data: {
          filePath: path,
          fileName: path.split('/').pop() ?? path,
          language: getLang(path),
          sectionLabel: 'Related',
          sectionIndex: -1,
          color: fallbackColor,
        },
      });
    }
  }

  const rawNodes = [...nodeMap.values()];

  // Build edges
  const rawEdges: Edge[] = [];

  if (parsedEdges.length > 0) {
    // Curated edges: styled distinctly as learning connections
    for (const e of parsedEdges) {
      if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) continue;
      const color = nodeMap.get(e.source)!.data.color;
      rawEdges.push({
        id: `ch|||${e.source}|||${e.target}`,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        ...(e.label
          ? {
              label: e.label,
              labelStyle: { fill: color, fontSize: 8, fontFamily: 'monospace' },
              labelBgStyle: { fill: '#0d0d0d', fillOpacity: 0.85 },
            }
          : {}),
        style: { stroke: color, strokeOpacity: 0.85, strokeWidth: 2 },
      });
    }
  } else {
    // Fallback: guide/analysis edges between chapter nodes
    for (const edge of allFileEdges) {
      if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
        rawEdges.push(edge);
      }
    }
  }

  // Merge .c/.h pairs
  const { nodes: finalNodes, edges: finalEdges } = mergeCHPairs(rawNodes, rawEdges);

  // Dagre layout
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 55, ranksep: 130, marginx: 40, marginy: 40 });

  for (const node of finalNodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of finalEdges) {
    g.setEdge(edge.source, edge.target);
  }

  console.time('[graph-data] buildChapterView dagre');
  Dagre.layout(g);
  console.timeEnd('[graph-data] buildChapterView dagre');

  for (const node of finalNodes) {
    const n = g.node(node.id);
    if (n) {
      node.position = { x: n.x - NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 };
    }
  }

  console.log(
    `[graph-data] buildChapterView → ${finalNodes.length} nodes, ${finalEdges.length} edges`
  );
  console.timeEnd('[graph-data] buildChapterView');
  return { nodes: finalNodes, edges: finalEdges };
}

// ─── Post-analysis edge projection (no Dagre re-layout) ───────────────────────

/**
 * Re-project `allFileEdges` onto the current CWD view without running Dagre.
 * Called after code analysis completes so we can update edges while preserving
 * the node positions that were already computed at initial render.
 */
export function projectEdgesForCwd(
  allFileNodes: Node<FileNodeData>[],
  allFileEdges: Edge[],
  cwd: string
): Edge[] {
  // Classify files in current cwd: direct files vs. files inside sub-folders
  const directFiles: Node<FileNodeData>[] = [];

  for (const node of allFileNodes) {
    const filePath = node.data.filePath;
    if (cwd !== '' && !filePath.startsWith(cwd + '/')) continue;
    const relPath = cwd === '' ? filePath : filePath.slice(cwd.length + 1);
    if (relPath.indexOf('/') === -1) directFiles.push(node);
  }

  // C/H pair remap for direct files (mirrors mergeCHPairs logic)
  const pairRemap = new Map<string, string>();
  const pairedIds = new Set<string>();
  const cFiles = directFiles.filter((n) => /\.c$/i.test(n.id));
  const hFiles = directFiles.filter((n) => /\.h$/i.test(n.id));

  for (const cNode of cFiles) {
    if (pairedIds.has(cNode.id)) continue;
    const cStem = cNode.data.fileName.replace(/\.c$/i, '').toLowerCase();
    const hNode = hFiles.find(
      (h) => !pairedIds.has(h.id) && h.data.fileName.replace(/\.h$/i, '').toLowerCase() === cStem
    );
    if (!hNode) continue;
    pairedIds.add(cNode.id);
    pairedIds.add(hNode.id);
    const pairedId = `${cNode.id}|||${hNode.id}`;
    pairRemap.set(cNode.id, pairedId);
    pairRemap.set(hNode.id, pairedId);
  }

  function getRepresentative(filePath: string): string | null {
    if (cwd !== '' && !filePath.startsWith(cwd + '/')) return null;
    const relPath = cwd === '' ? filePath : filePath.slice(cwd.length + 1);
    const firstSlash = relPath.indexOf('/');
    if (firstSlash === -1) return filePath;
    const subdir = relPath.slice(0, firstSlash);
    return `folder:${cwd === '' ? subdir : `${cwd}/${subdir}`}`;
  }

  const edgeAgg = new Map<
    string,
    { source: string; target: string; color: string; count: number }
  >();

  for (const edge of allFileEdges) {
    let srcRep = getRepresentative(edge.source);
    let tgtRep = getRepresentative(edge.target);
    if (!srcRep || !tgtRep) continue;
    srcRep = pairRemap.get(srcRep) ?? srcRep;
    tgtRep = pairRemap.get(tgtRep) ?? tgtRep;
    if (srcRep === tgtRep) continue;
    const key = `${srcRep}|||${tgtRep}`;
    if (!edgeAgg.has(key)) {
      const color = allFileNodes.find((n) => n.id === edge.source)?.data.color ?? '#555';
      edgeAgg.set(key, { source: srcRep, target: tgtRep, color, count: 0 });
    }
    edgeAgg.get(key)!.count++;
  }

  return [...edgeAgg.values()].map(({ source, target, color, count }) => ({
    id: `cwd|||${source}|||${target}`,
    source,
    target,
    type: 'smoothstep',
    style: {
      stroke: color,
      strokeOpacity: 0.6,
      strokeWidth: Math.min(1 + count * 0.3, 3.5),
    },
  }));
}

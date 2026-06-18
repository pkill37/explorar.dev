import type { Edge, Node } from '@xyflow/react';
import type { FileNodeData, FolderNodeData, PairedNodeData } from '@/lib/graph-data';

export type OpenCodeIntelFormat = 'lsp' | 'scip' | 'lsif' | 'sarif' | 'custom';
export type OpenCodeIntelProvenance = 'lsp' | 'scip' | 'lsif' | 'sarif' | 'custom';

export interface ImportedCodeSymbol {
  name: string;
  kind: string;
  filePath: string;
  line?: number;
  detail?: string;
  provenance: OpenCodeIntelProvenance;
}

export interface ImportedCodeReference {
  fromFilePath: string;
  toFilePath: string;
  label: string;
  detail?: string;
  provenance: OpenCodeIntelProvenance;
}

export interface ImportedCodeDiagnostic {
  filePath: string;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  line?: number;
  source?: string;
  provenance: OpenCodeIntelProvenance;
}

export interface OpenCodeIntelBundle {
  format: OpenCodeIntelFormat;
  importedAt: string;
  symbols: ImportedCodeSymbol[];
  references: ImportedCodeReference[];
  diagnostics: ImportedCodeDiagnostic[];
}

export interface NodeEvidenceSummary {
  symbols: ImportedCodeSymbol[];
  references: ImportedCodeReference[];
  diagnostics: ImportedCodeDiagnostic[];
  graphEdges: Array<{ label: string; type: string; direction: 'incoming' | 'outgoing' }>;
}

const STORAGE_PREFIX = 'explorar-open-code-intel';

type GraphNode = Node<FileNodeData | FolderNodeData | PairedNodeData>;

function stripFileProtocol(value: string): string {
  if (!value.startsWith('file://')) return value;
  try {
    return decodeURIComponent(new URL(value).pathname);
  } catch {
    return value.replace(/^file:\/+/, '/');
  }
}

function normalizeFilePath(value: string, repoHint?: string): string {
  const withoutProtocol = stripFileProtocol(value).replace(/\\/g, '/').trim();
  const withoutLeadingDot = withoutProtocol.replace(/^\.\//, '');
  const withoutWindowsDrive = withoutLeadingDot.replace(/^[A-Za-z]:\//, '');
  const normalized = withoutWindowsDrive.replace(/^\/+/, '');

  if (!repoHint) {
    return normalized;
  }

  const repoMarker = `/${repoHint}/`;
  const markerIndex = normalized.indexOf(repoMarker);
  if (markerIndex >= 0) {
    return normalized.slice(markerIndex + repoMarker.length);
  }

  if (normalized.startsWith(`${repoHint}/`)) {
    return normalized.slice(repoHint.length + 1);
  }

  return normalized;
}

function dedupeByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeBundle(bundle: OpenCodeIntelBundle, repoHint?: string): OpenCodeIntelBundle {
  return {
    ...bundle,
    symbols: dedupeByKey(
      bundle.symbols
        .map((symbol) => ({
          ...symbol,
          filePath: normalizeFilePath(symbol.filePath, repoHint),
        }))
        .filter((symbol) => symbol.name && symbol.filePath),
      (symbol) => `${symbol.provenance}:${symbol.filePath}:${symbol.name}:${symbol.line ?? 0}`
    ),
    references: dedupeByKey(
      bundle.references
        .map((reference) => ({
          ...reference,
          fromFilePath: normalizeFilePath(reference.fromFilePath, repoHint),
          toFilePath: normalizeFilePath(reference.toFilePath, repoHint),
        }))
        .filter((reference) => reference.fromFilePath && reference.toFilePath),
      (reference) =>
        `${reference.provenance}:${reference.fromFilePath}:${reference.toFilePath}:${reference.label}`
    ),
    diagnostics: dedupeByKey(
      bundle.diagnostics
        .map((diagnostic) => ({
          ...diagnostic,
          filePath: normalizeFilePath(diagnostic.filePath, repoHint),
        }))
        .filter((diagnostic) => diagnostic.filePath && diagnostic.message),
      (diagnostic) =>
        `${diagnostic.provenance}:${diagnostic.filePath}:${diagnostic.line ?? 0}:${diagnostic.message}`
    ),
  };
}

function parseSeverity(value: unknown): ImportedCodeDiagnostic['severity'] {
  if (typeof value === 'number') {
    if (value <= 1) return 'error';
    if (value === 2) return 'warning';
    if (value === 3) return 'info';
    return 'hint';
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower.includes('error')) return 'error';
    if (lower.includes('warn')) return 'warning';
    if (lower.includes('info') || lower.includes('note')) return 'info';
  }
  return 'hint';
}

function getRangeLine(range: unknown): number | undefined {
  if (!Array.isArray(range) || typeof range[0] !== 'number') {
    return undefined;
  }
  return range[0] + 1;
}

function symbolNameFromScip(value: string): string {
  const descriptor = value.split(' ').find((part) => part.includes('#') || part.includes('.'));
  const raw = descriptor ?? value;
  const segments = raw.split(/[\/#.]/).filter(Boolean);
  return segments[segments.length - 1] ?? value;
}

function parseLspBundle(input: Record<string, unknown>): OpenCodeIntelBundle {
  const symbols: ImportedCodeSymbol[] = [];
  const references: ImportedCodeReference[] = [];
  const diagnostics: ImportedCodeDiagnostic[] = [];

  const workspaceSymbols = Array.isArray(input.workspaceSymbols) ? input.workspaceSymbols : [];
  for (const symbol of workspaceSymbols) {
    if (!symbol || typeof symbol !== 'object') continue;
    const entry = symbol as Record<string, unknown>;
    const location = (entry.location as Record<string, unknown> | undefined) ?? entry;
    const uri =
      (location.uri as string | undefined) ??
      (location.filePath as string | undefined) ??
      (entry.uri as string | undefined) ??
      (entry.filePath as string | undefined);
    if (!uri || typeof entry.name !== 'string') continue;
    symbols.push({
      name: entry.name,
      kind: String(entry.kind ?? 'symbol'),
      filePath: uri,
      line: getRangeLine(
        (location.range as Record<string, unknown> | undefined)?.start ?? entry.range
      ),
      detail: typeof entry.detail === 'string' ? entry.detail : undefined,
      provenance: 'lsp',
    });
  }

  const documentSymbols = Array.isArray(input.documentSymbols) ? input.documentSymbols : [];
  for (const symbol of documentSymbols) {
    if (!symbol || typeof symbol !== 'object') continue;
    const entry = symbol as Record<string, unknown>;
    const uri = (entry.uri as string | undefined) ?? (entry.filePath as string | undefined);
    if (!uri || typeof entry.name !== 'string') continue;
    symbols.push({
      name: entry.name,
      kind: String(entry.kind ?? 'symbol'),
      filePath: uri,
      line: getRangeLine(
        (entry.range as Record<string, unknown> | undefined)?.start ?? entry.range
      ),
      detail: typeof entry.detail === 'string' ? entry.detail : undefined,
      provenance: 'lsp',
    });
  }

  const lspReferences = Array.isArray(input.references) ? input.references : [];
  for (const reference of lspReferences) {
    if (!reference || typeof reference !== 'object') continue;
    const entry = reference as Record<string, unknown>;
    const source = (entry.source as Record<string, unknown> | undefined) ?? {};
    const target = (entry.target as Record<string, unknown> | undefined) ?? {};
    const fromFilePath =
      (source.uri as string | undefined) ?? (source.filePath as string | undefined);
    const toFilePath =
      (target.uri as string | undefined) ?? (target.filePath as string | undefined);
    if (!fromFilePath || !toFilePath) continue;
    references.push({
      fromFilePath,
      toFilePath,
      label: String(entry.kind ?? 'reference'),
      detail: typeof entry.name === 'string' ? entry.name : undefined,
      provenance: 'lsp',
    });
  }

  const lspDiagnostics = Array.isArray(input.diagnostics) ? input.diagnostics : [];
  for (const diagnostic of lspDiagnostics) {
    if (!diagnostic || typeof diagnostic !== 'object') continue;
    const entry = diagnostic as Record<string, unknown>;
    const filePath = (entry.uri as string | undefined) ?? (entry.filePath as string | undefined);
    if (!filePath || typeof entry.message !== 'string') continue;
    diagnostics.push({
      filePath,
      message: entry.message,
      severity: parseSeverity(entry.severity),
      line: getRangeLine(
        (entry.range as Record<string, unknown> | undefined)?.start ?? entry.range
      ),
      source: typeof entry.source === 'string' ? entry.source : 'LSP',
      provenance: 'lsp',
    });
  }

  return {
    format: 'lsp',
    importedAt: new Date().toISOString(),
    symbols,
    references,
    diagnostics,
  };
}

function parseScipBundle(input: Record<string, unknown>): OpenCodeIntelBundle {
  const symbols: ImportedCodeSymbol[] = [];
  const documents = Array.isArray(input.documents) ? input.documents : [];

  for (const document of documents) {
    if (!document || typeof document !== 'object') continue;
    const entry = document as Record<string, unknown>;
    const filePath =
      (entry.relative_path as string | undefined) ??
      (entry.path as string | undefined) ??
      (entry.uri as string | undefined);
    if (!filePath) continue;

    const occurrences = Array.isArray(entry.occurrences) ? entry.occurrences : [];
    for (const occurrence of occurrences) {
      if (!occurrence || typeof occurrence !== 'object') continue;
      const occ = occurrence as Record<string, unknown>;
      const symbolValue = typeof occ.symbol === 'string' ? occ.symbol : undefined;
      if (!symbolValue) continue;
      symbols.push({
        name: symbolNameFromScip(symbolValue),
        kind:
          typeof occ.symbol_roles === 'number' && occ.symbol_roles > 0 ? 'definition' : 'symbol',
        filePath,
        line: getRangeLine(occ.range),
        detail: symbolValue,
        provenance: 'scip',
      });
    }
  }

  return {
    format: 'scip',
    importedAt: new Date().toISOString(),
    symbols,
    references: [],
    diagnostics: [],
  };
}

function parseLsifBundle(input: Record<string, unknown>): OpenCodeIntelBundle {
  const symbols: ImportedCodeSymbol[] = [];
  const vertices = Array.isArray(input.vertices) ? input.vertices : [];
  const edges = Array.isArray(input.edges) ? input.edges : [];
  const vertexMap = new Map<number | string, Record<string, unknown>>();
  const documentContains = new Map<number | string, Array<number | string>>();

  for (const vertex of vertices) {
    if (!vertex || typeof vertex !== 'object') continue;
    const entry = vertex as Record<string, unknown>;
    if (entry.id === undefined) continue;
    vertexMap.set(entry.id as number | string, entry);
  }

  for (const edge of edges) {
    if (!edge || typeof edge !== 'object') continue;
    const entry = edge as Record<string, unknown>;
    if (entry.label !== 'contains') continue;
    const outV = entry.outV as number | string | undefined;
    const inVs = Array.isArray(entry.inVs) ? entry.inVs : [];
    if (!outV) continue;
    documentContains.set(outV, inVs as Array<number | string>);
  }

  for (const [vertexId, vertex] of vertexMap.entries()) {
    if (vertex.label !== 'document') continue;
    const filePath = (vertex.uri as string | undefined) ?? (vertex.path as string | undefined);
    if (!filePath) continue;
    const rangeIds = documentContains.get(vertexId) ?? [];
    for (const rangeId of rangeIds) {
      const rangeVertex = vertexMap.get(rangeId);
      const tag = rangeVertex?.tag as Record<string, unknown> | undefined;
      const start = rangeVertex?.start as { line?: number } | undefined;
      if (!rangeVertex || !tag || typeof tag.text !== 'string') continue;
      symbols.push({
        name: tag.text,
        kind: String(tag.type ?? rangeVertex.label ?? 'symbol'),
        filePath,
        line: typeof start?.line === 'number' ? start.line + 1 : undefined,
        detail: typeof tag.kind === 'string' ? tag.kind : undefined,
        provenance: 'lsif',
      });
    }
  }

  return {
    format: 'lsif',
    importedAt: new Date().toISOString(),
    symbols,
    references: [],
    diagnostics: [],
  };
}

function parseSarifBundle(input: Record<string, unknown>): OpenCodeIntelBundle {
  const diagnostics: ImportedCodeDiagnostic[] = [];
  const runs = Array.isArray(input.runs) ? input.runs : [];

  for (const run of runs) {
    if (!run || typeof run !== 'object') continue;
    const runEntry = run as Record<string, unknown>;
    const toolName = (
      (runEntry.tool as Record<string, unknown> | undefined)?.driver as
        | Record<string, unknown>
        | undefined
    )?.name as string | undefined;
    const results = Array.isArray(runEntry.results) ? runEntry.results : [];

    for (const result of results) {
      if (!result || typeof result !== 'object') continue;
      const resultEntry = result as Record<string, unknown>;
      const locations = Array.isArray(resultEntry.locations) ? resultEntry.locations : [];
      for (const location of locations) {
        if (!location || typeof location !== 'object') continue;
        const loc = location as Record<string, unknown>;
        const physical = loc.physicalLocation as Record<string, unknown> | undefined;
        const artifact = physical?.artifactLocation as Record<string, unknown> | undefined;
        const region = physical?.region as Record<string, unknown> | undefined;
        const filePath =
          (artifact?.uri as string | undefined) ?? (artifact?.uriBaseId as string | undefined);
        const message =
          ((resultEntry.message as Record<string, unknown> | undefined)?.text as
            | string
            | undefined) ?? (resultEntry.ruleId as string | undefined);
        if (!filePath || !message) continue;
        diagnostics.push({
          filePath,
          message,
          severity: parseSeverity(resultEntry.level),
          line: typeof region?.startLine === 'number' ? region.startLine : undefined,
          source: toolName ?? 'SARIF',
          provenance: 'sarif',
        });
      }
    }
  }

  return {
    format: 'sarif',
    importedAt: new Date().toISOString(),
    symbols: [],
    references: [],
    diagnostics,
  };
}

function parseCustomBundle(input: Record<string, unknown>): OpenCodeIntelBundle {
  const symbols = Array.isArray(input.symbols) ? input.symbols : [];
  const references = Array.isArray(input.references) ? input.references : [];
  const diagnostics = Array.isArray(input.diagnostics) ? input.diagnostics : [];

  return {
    format: 'custom',
    importedAt: new Date().toISOString(),
    symbols: symbols
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
      .map((entry) => ({
        name: String(entry.name ?? 'symbol'),
        kind: String(entry.kind ?? 'symbol'),
        filePath: String(entry.filePath ?? entry.uri ?? ''),
        line: typeof entry.line === 'number' ? entry.line : undefined,
        detail: typeof entry.detail === 'string' ? entry.detail : undefined,
        provenance: 'custom' as const,
      })),
    references: references
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
      .map((entry) => ({
        fromFilePath: String(entry.fromFilePath ?? entry.source ?? ''),
        toFilePath: String(entry.toFilePath ?? entry.target ?? ''),
        label: String(entry.label ?? entry.kind ?? 'reference'),
        detail: typeof entry.detail === 'string' ? entry.detail : undefined,
        provenance: 'custom' as const,
      })),
    diagnostics: diagnostics
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
      .map((entry) => ({
        filePath: String(entry.filePath ?? entry.uri ?? ''),
        message: String(entry.message ?? ''),
        severity: parseSeverity(entry.severity),
        line: typeof entry.line === 'number' ? entry.line : undefined,
        source: typeof entry.source === 'string' ? entry.source : 'custom',
        provenance: 'custom' as const,
      })),
  };
}

export function parseOpenCodeIntel(raw: string, repoHint?: string): OpenCodeIntelBundle {
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  let bundle: OpenCodeIntelBundle;
  if (Array.isArray(parsed.runs)) {
    bundle = parseSarifBundle(parsed);
  } else if (Array.isArray(parsed.documents)) {
    bundle = parseScipBundle(parsed);
  } else if (Array.isArray(parsed.vertices) && Array.isArray(parsed.edges)) {
    bundle = parseLsifBundle(parsed);
  } else if (
    Array.isArray(parsed.workspaceSymbols) ||
    Array.isArray(parsed.documentSymbols) ||
    Array.isArray(parsed.references) ||
    Array.isArray(parsed.diagnostics)
  ) {
    bundle = parseLspBundle(parsed);
  } else {
    bundle = parseCustomBundle(parsed);
  }

  return normalizeBundle(bundle, repoHint);
}

export function getOpenCodeIntelStorageKey(owner: string, repo: string, branch: string): string {
  return `${STORAGE_PREFIX}:${owner}:${repo}:${branch}`;
}

export function loadOpenCodeIntelBundle(
  owner: string,
  repo: string,
  branch: string
): OpenCodeIntelBundle | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(getOpenCodeIntelStorageKey(owner, repo, branch));
  if (!raw) {
    return null;
  }

  try {
    return normalizeBundle(JSON.parse(raw) as OpenCodeIntelBundle, repo);
  } catch {
    return null;
  }
}

function normalizeSymbolQuery(value: string): string {
  return value
    .trim()
    .replace(/\(\)$/, '')
    .replace(/^(struct|class|enum)\s+/, '');
}

export function findImportedSymbolLocation(
  bundle: OpenCodeIntelBundle | null,
  filePaths: string[],
  symbolName: string
): { filePath: string; line: number } | null {
  if (!bundle || filePaths.length === 0 || !symbolName) {
    return null;
  }

  const normalizedQuery = normalizeSymbolQuery(symbolName);
  const normalizedFilePathSet = new Set(filePaths.map((filePath) => normalizeFilePath(filePath)));
  const exactMatches = bundle.symbols.filter((symbol) => {
    const normalizedSymbolFilePath = normalizeFilePath(symbol.filePath);
    if (!normalizedFilePathSet.has(normalizedSymbolFilePath)) return false;
    if (typeof symbol.line !== 'number' || symbol.line < 1) return false;
    return normalizeSymbolQuery(symbol.name) === normalizedQuery;
  });

  if (exactMatches.length === 0) {
    return null;
  }

  const scored = exactMatches
    .map((symbol) => {
      const kind = symbol.kind.toLowerCase();
      const detail = symbol.detail?.toLowerCase() ?? '';
      const definitionScore =
        kind.includes('definition') ||
        kind.includes('function') ||
        detail.includes('definition') ||
        detail.includes('function')
          ? 2
          : 0;
      return { symbol, definitionScore };
    })
    .sort(
      (a, b) => b.definitionScore - a.definitionScore || (a.symbol.line ?? 0) - (b.symbol.line ?? 0)
    );

  const winner = scored[0]?.symbol;
  if (!winner?.line) {
    return null;
  }

  return {
    filePath: normalizeFilePath(winner.filePath),
    line: winner.line,
  };
}

export function saveOpenCodeIntelBundle(
  owner: string,
  repo: string,
  branch: string,
  bundle: OpenCodeIntelBundle | null
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const key = getOpenCodeIntelStorageKey(owner, repo, branch);
  if (!bundle) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(bundle));
}

export function buildImportedEdges(bundle: OpenCodeIntelBundle): Edge[] {
  return bundle.references.map((reference, index) => ({
    id: `imported-${index}-${reference.provenance}-${reference.fromFilePath}-${reference.toFilePath}`,
    source: reference.fromFilePath,
    target: reference.toFilePath,
    type: 'default',
    style: {
      stroke: '#f59e0b',
      strokeWidth: 1.4,
      strokeDasharray: '3 3',
      opacity: 0.8,
    },
    label: reference.label,
    labelStyle: {
      fill: '#fbbf24',
      fontSize: 7,
      fontFamily: 'monospace',
    },
    labelBgStyle: { fill: '#0d0d0d', fillOpacity: 0.72 },
    data: {
      relType: 'external',
      provenance: reference.provenance,
      detail: reference.detail,
    },
  }));
}

export function getSelectedNodePaths(nodeId: string | null, nodes: GraphNode[]): string[] {
  if (!nodeId) {
    return [];
  }

  const node = nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    return nodeId.split('|||');
  }

  if (node.type === 'pairedNode') {
    const data = node.data as PairedNodeData;
    return [data.primaryPath, data.headerPath];
  }

  if (node.type === 'folderNode') {
    const data = node.data as FolderNodeData;
    return data.filePaths;
  }

  return [nodeId];
}

export function getNodeEvidenceSummary(
  nodePaths: string[],
  bundle: OpenCodeIntelBundle | null,
  edges: Edge[]
): NodeEvidenceSummary {
  const pathSet = new Set(nodePaths);
  const symbols = bundle?.symbols.filter((symbol) => pathSet.has(symbol.filePath)) ?? [];
  const references =
    bundle?.references.filter(
      (reference) => pathSet.has(reference.fromFilePath) || pathSet.has(reference.toFilePath)
    ) ?? [];
  const diagnostics =
    bundle?.diagnostics.filter((diagnostic) => pathSet.has(diagnostic.filePath)) ?? [];

  const graphEdges = edges
    .filter((edge) => pathSet.has(edge.source) || pathSet.has(edge.target))
    .map((edge) => ({
      label: String(edge.label ?? edge.data?.relType ?? 'edge'),
      type: String(edge.data?.relType ?? (edge.id.startsWith('analysis-') ? 'analysis' : 'guide')),
      direction: pathSet.has(edge.source) ? 'outgoing' : ('incoming' as 'incoming' | 'outgoing'),
    }));

  return { symbols, references, diagnostics, graphEdges };
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function findQueryMatchedNodeIds(
  query: string,
  nodes: GraphNode[],
  bundle: OpenCodeIntelBundle | null
): string[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return [];
  }

  const bundleByPath = new Map<
    string,
    {
      symbols: ImportedCodeSymbol[];
      diagnostics: ImportedCodeDiagnostic[];
      references: ImportedCodeReference[];
    }
  >();

  for (const symbol of bundle?.symbols ?? []) {
    const entry = bundleByPath.get(symbol.filePath) ?? {
      symbols: [],
      diagnostics: [],
      references: [],
    };
    entry.symbols.push(symbol);
    bundleByPath.set(symbol.filePath, entry);
  }

  for (const diagnostic of bundle?.diagnostics ?? []) {
    const entry = bundleByPath.get(diagnostic.filePath) ?? {
      symbols: [],
      diagnostics: [],
      references: [],
    };
    entry.diagnostics.push(diagnostic);
    bundleByPath.set(diagnostic.filePath, entry);
  }

  for (const reference of bundle?.references ?? []) {
    for (const path of [reference.fromFilePath, reference.toFilePath]) {
      const entry = bundleByPath.get(path) ?? { symbols: [], diagnostics: [], references: [] };
      entry.references.push(reference);
      bundleByPath.set(path, entry);
    }
  }

  return nodes
    .filter((node) => {
      const filePaths = getSelectedNodePaths(node.id, nodes);
      const haystack = new Set<string>();
      haystack.add(node.id.toLowerCase());
      if (node.type === 'fileNode') {
        const data = node.data as FileNodeData;
        haystack.add(data.fileName.toLowerCase());
        haystack.add(data.sectionLabel.toLowerCase());
        haystack.add(data.language.toLowerCase());
      }

      for (const path of filePaths) {
        haystack.add(path.toLowerCase());
        const evidence = bundleByPath.get(path);
        for (const symbol of evidence?.symbols ?? []) {
          haystack.add(symbol.name.toLowerCase());
          haystack.add(symbol.kind.toLowerCase());
          if (symbol.detail) haystack.add(symbol.detail.toLowerCase());
        }
        for (const diagnostic of evidence?.diagnostics ?? []) {
          haystack.add(diagnostic.message.toLowerCase());
          if (diagnostic.source) haystack.add(diagnostic.source.toLowerCase());
        }
        for (const reference of evidence?.references ?? []) {
          haystack.add(reference.label.toLowerCase());
          if (reference.detail) haystack.add(reference.detail.toLowerCase());
        }
      }

      const combined = Array.from(haystack).join(' ');
      return tokens.every((token) => combined.includes(token));
    })
    .map((node) => node.id);
}

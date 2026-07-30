'use client';

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  findSymbolsInFile,
  findDefinition,
  findAllReferences,
  findReferencesInContent,
  type Location,
  type SymbolReference,
} from '@/lib/cross-reference';
import type { LoadedCodeIndex } from '@/lib/code-index';
import {
  HeuristicLanguageBackend,
  IndexedLanguageBackend,
  LanguageBackendRegistry,
  type BackendDefinition,
  type LanguageBackendContext,
} from '@/lib/language-backends';
import { configureMonacoEnvironment as configureMonacoWorkers } from '@/lib/monaco-config';
import { debugLog } from '@/lib/browser-debug';

type FileFetchResultLike = {
  content: string;
};

type FetchFileFn = (path: string) => Promise<FileFetchResultLike>;
type OpenFileFn = (
  path: string,
  searchPattern?: string,
  scrollToLine?: number,
  searchScope?: string[]
) => void;

const INDEXABLE_SOURCE_EXTENSIONS = new Set([
  'c',
  'cc',
  'cpp',
  'cxx',
  'h',
  'hh',
  'hpp',
  'hxx',
  'inc',
  'inl',
  'ipp',
  'S',
  's',
]);

const workspaceSymbolsCache = new Map<string, SymbolReference[]>();
const workspaceContentsCache = new Map<string, string>();
const workspaceReferencesCache = new Map<string, Location[]>();
const workspaceReferencesPromiseCache = new Map<string, Promise<Location[]>>();

function buildWorkspaceCacheKey(workspaceId: string, filePath: string): string {
  return `${workspaceId}:${filePath}`;
}

function getPathExtension(filePath: string): string {
  return filePath.split('.').pop() || '';
}

function getPathDirectory(filePath: string): string {
  const lastSlashIndex = filePath.lastIndexOf('/');
  return lastSlashIndex === -1 ? '' : filePath.slice(0, lastSlashIndex);
}

function getPathBasename(filePath: string): string {
  const lastSlashIndex = filePath.lastIndexOf('/');
  return lastSlashIndex === -1 ? filePath : filePath.slice(lastSlashIndex + 1);
}

function getPathStem(filePath: string): string {
  const basename = getPathBasename(filePath);
  const lastDotIndex = basename.lastIndexOf('.');
  return lastDotIndex === -1 ? basename : basename.slice(0, lastDotIndex);
}

function normalizeSymbolQuery(symbolName: string): string {
  return symbolName
    .trim()
    .replace(/\(\)$/, '')
    .replace(/^(struct|class|enum)\s+/, '');
}

function isIndexableSourceFile(filePath: string): boolean {
  return INDEXABLE_SOURCE_EXTENSIONS.has(getPathExtension(filePath));
}

function extractIncludeTargets(content: string): string[] {
  const includePattern = /^\s*#\s*include\s*[<"]([^>"]+)[>"]/gm;
  const includeTargets: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = includePattern.exec(content)) !== null) {
    includeTargets.push(match[1]);
  }

  return includeTargets;
}

function rankWorkspaceCandidatePaths(
  symbolName: string,
  currentFilePath: string,
  content: string,
  workspaceFilePaths: string[]
): string[] {
  const normalizedSymbol = normalizeSymbolQuery(symbolName).toLowerCase();
  const currentDir = getPathDirectory(currentFilePath);
  const currentStem = getPathStem(currentFilePath).toLowerCase();
  const includeTargets = new Set(extractIncludeTargets(content));
  const includeBasenames = new Set(Array.from(includeTargets, (target) => getPathBasename(target)));
  const candidateScores = new Map<string, number>();

  const addCandidate = (filePath: string, score: number) => {
    if (!filePath || !isIndexableSourceFile(filePath)) return;
    const previous = candidateScores.get(filePath) ?? Number.NEGATIVE_INFINITY;
    if (score > previous) {
      candidateScores.set(filePath, score);
    }
  };

  addCandidate(currentFilePath, 1000);

  for (const filePath of workspaceFilePaths) {
    const basename = getPathBasename(filePath);
    const stem = getPathStem(filePath).toLowerCase();
    const dir = getPathDirectory(filePath);
    let score = 0;

    if (stem === currentStem && filePath !== currentFilePath) score += 950;
    if (includeTargets.has(filePath) || includeBasenames.has(basename)) score += 900;
    if (dir === currentDir) score += 500;
    if (stem === normalizedSymbol) score += 700;
    if (stem.includes(normalizedSymbol) || basename.toLowerCase().includes(normalizedSymbol)) {
      score += 350;
    }
    if (basename.endsWith('.h') || basename.endsWith('.hpp') || basename.endsWith('.hh')) {
      score += 125;
    }

    if (score > 0) {
      addCandidate(filePath, score);
    }
  }

  const rankedCandidates = Array.from(candidateScores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([filePath]) => filePath);

  const remainingCandidates = workspaceFilePaths
    .filter((filePath) => isIndexableSourceFile(filePath) && !candidateScores.has(filePath))
    .sort();

  return [...rankedCandidates, ...remainingCandidates];
}

function rankReferenceCandidatePaths(
  symbolName: string,
  currentFilePath: string,
  definitionFilePath: string | undefined,
  content: string,
  workspaceFilePaths: string[]
): string[] {
  const normalizedSymbol = normalizeSymbolQuery(symbolName).toLowerCase();
  const currentDir = getPathDirectory(currentFilePath);
  const currentTopLevelDir = currentFilePath.split('/')[0] || '';
  const definitionDir = definitionFilePath ? getPathDirectory(definitionFilePath) : '';
  const definitionTopLevelDir = definitionFilePath?.split('/')[0] || '';
  const currentStem = getPathStem(currentFilePath).toLowerCase();
  const definitionStem = definitionFilePath ? getPathStem(definitionFilePath).toLowerCase() : '';
  const includeTargets = new Set(extractIncludeTargets(content));
  const includeBasenames = new Set(Array.from(includeTargets, (target) => getPathBasename(target)));
  const candidateScores = new Map<string, number>();

  const addCandidate = (filePath: string, score: number) => {
    if (!filePath || !isIndexableSourceFile(filePath)) return;
    const previous = candidateScores.get(filePath) ?? Number.NEGATIVE_INFINITY;
    if (score > previous) {
      candidateScores.set(filePath, score);
    }
  };

  addCandidate(currentFilePath, 5000);
  if (definitionFilePath) {
    addCandidate(definitionFilePath, 4900);
  }

  for (const filePath of workspaceFilePaths) {
    if (!isIndexableSourceFile(filePath)) continue;

    const basename = getPathBasename(filePath);
    const stem = getPathStem(filePath).toLowerCase();
    const dir = getPathDirectory(filePath);
    const topLevelDir = filePath.split('/')[0] || '';
    let score = 0;

    if (dir === currentDir) score += 2200;
    if (definitionDir && dir === definitionDir) score += 2000;
    if (topLevelDir && topLevelDir === currentTopLevelDir) score += 1100;
    if (definitionTopLevelDir && topLevelDir === definitionTopLevelDir) score += 1000;
    if (stem === currentStem || (definitionStem && stem === definitionStem)) score += 900;
    if (includeTargets.has(filePath) || includeBasenames.has(basename)) score += 800;
    if (stem === normalizedSymbol) score += 700;
    if (stem.includes(normalizedSymbol) || basename.toLowerCase().includes(normalizedSymbol)) {
      score += 250;
    }

    if (score > 0) {
      addCandidate(filePath, score);
    }
  }

  return Array.from(candidateScores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([filePath]) => filePath);
}

function findBestMatchingSymbolDefinition(
  symbolName: string,
  symbols: SymbolReference[]
): SymbolReference | null {
  const normalizedSymbol = normalizeSymbolQuery(symbolName);

  return (
    findDefinition(normalizedSymbol, symbols) ??
    symbols.find(
      (symbol) => symbol.isDefinition && normalizeSymbolQuery(symbol.name) === normalizedSymbol
    ) ??
    symbols.find((symbol) => normalizeSymbolQuery(symbol.name) === normalizedSymbol) ??
    null
  );
}

function backendDefinitionToSymbolReference(definition: BackendDefinition): SymbolReference {
  return {
    name: definition.name,
    type: definition.kind === 'type' ? 'typedef' : (definition.kind as SymbolReference['type']),
    line: definition.line,
    column: definition.column,
    file: definition.file,
    isDefinition: true,
    isDeclaration: false,
    signature: definition.signature,
    documentation: definition.documentation,
    references: [],
    relatedSymbols: [],
  };
}

function symbolReferenceToBackendDefinition(symbol: SymbolReference): BackendDefinition {
  return {
    name: symbol.name,
    kind: symbol.type,
    file: symbol.file,
    line: symbol.line,
    column: symbol.column,
    signature: symbol.signature,
    documentation: symbol.documentation,
  };
}

// Dynamically import Monaco Editor to avoid SSR issues
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="vscode-loading">
      <div className="vscode-spinner" />
      <div>Loading editor...</div>
    </div>
  ),
});

interface MonacoCodeEditorProps {
  filePath: string;
  content: string;
  contentFilePath?: string;
  isLoading: boolean;
  scrollToLine?: number;
  searchPattern?: string;
  navigationNonce?: number;
  onCursorChange?: (line: number, column: number) => void;
  onOpenFile?: OpenFileFn;
  fetchFile?: FetchFileFn;
  workspaceFilePaths?: string[];
  workspaceId?: string;
  codeIndex?: LoadedCodeIndex | null;
}

type MonacoEditorLike = {
  layout: (dimension?: { width: number; height: number }) => void;
  updateOptions: (options: Record<string, unknown>) => void;
  getModel: () => {
    getValue: () => string;
    setValue: (value: string) => void;
    uri?: unknown;
  } | null;
  onDidChangeCursorPosition: (
    listener: (e: { position: { lineNumber: number; column: number } }) => void
  ) => { dispose: () => void } | void;
  onDidChangeModel: (
    listener: (e: { newModelUrl?: unknown; oldModelUrl?: unknown }) => void
  ) => { dispose: () => void } | void;
  getPosition: () => { lineNumber: number; column: number } | null;
  addCommand: (keybinding: number, handler: () => void) => string | null;
  getAction: (actionId: string) => { run: () => Promise<void> } | null;
  onMouseDown: (
    listener: (e: {
      event: { ctrlKey: boolean; metaKey: boolean; preventDefault: () => void };
      target: { position?: { lineNumber: number; column: number } };
    }) => void
  ) => void;
};

type MonacoLanguageApi = {
  FoldingRangeKind: {
    Comment: unknown;
    Imports: unknown;
  };
  registerFoldingRangeProvider: (
    languageSelector: string,
    provider: {
      provideFoldingRanges: () => Array<{
        start: number;
        end: number;
        kind?: unknown;
      }>;
    }
  ) => { dispose: () => void };
};

type MonacoTestApi = {
  getActiveFilePath: () => string;
  focusSymbol: (symbol: string) => Promise<boolean>;
  showReferencesAtCursor: () => Promise<boolean>;
  closeReferencesWidget: () => Promise<boolean>;
  goToDefinitionAtCursor: () => Promise<boolean>;
};

type XrefReferenceItem = Location & {
  key: string;
  preview: string;
  fileName: string;
  directory: string;
};

type XrefPanelState = {
  symbolName: string;
  references: XrefReferenceItem[];
  selectedReferenceKey: string | null;
  isLoading: boolean;
  error: string | null;
};

const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = ({
  filePath,
  content,
  contentFilePath,
  isLoading,
  scrollToLine,
  searchPattern,
  navigationNonce,
  onCursorChange,
  onOpenFile,
  fetchFile,
  workspaceFilePaths = [],
  workspaceId = 'default',
  codeIndex = null,
}) => {
  const editorRef = useRef<unknown>(null);
  const monacoRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const decorationsRef = useRef<string[]>([]);
  const symbolsRef = useRef<SymbolReference[]>([]);
  const providerDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const monacoModelCreationPromisesRef = useRef<Map<string, Promise<unknown | null>>>(new Map());
  const [hasMountedEditor, setHasMountedEditor] = useState(false);
  const [xrefPanelState, setXrefPanelState] = useState<XrefPanelState | null>(null);

  const disposeRegisteredProviders = useCallback(() => {
    for (const disposable of providerDisposablesRef.current) {
      disposable.dispose();
    }
    providerDisposablesRef.current = [];
  }, []);

  const revealTargetLine = useCallback((targetLine: number, lines: string[]) => {
    if (!editorRef.current || targetLine < 1) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = editorRef.current as any;

    if (decorationsRef.current.length > 0) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }

    editor.revealLineInCenter(targetLine);
    editor.setPosition({ lineNumber: targetLine, column: 1 });

    decorationsRef.current = editor.deltaDecorations(
      [],
      [
        {
          range: {
            startLineNumber: targetLine,
            startColumn: 1,
            endLineNumber: targetLine,
            endColumn: lines[targetLine - 1]?.length || 1,
          },
          options: {
            isWholeLine: true,
            className: 'highlight-line',
            glyphMarginClassName: 'highlight-line-glyph',
          },
        },
      ]
    );
  }, []);

  const findDefinitionLineForPattern = useCallback((pattern: string, lines: string[]): number => {
    const normalizedPattern = pattern.trim().replace(/\(\)$/, '');
    if (!normalizedPattern) return -1;

    const directDefinition = findDefinition(normalizedPattern, symbolsRef.current);
    if (directDefinition) {
      return directDefinition.line;
    }

    const exactDefinition = symbolsRef.current.find(
      (symbol) =>
        symbol.isDefinition &&
        (symbol.name === normalizedPattern ||
          symbol.name === normalizedPattern.replace(/^(struct|class|enum)\s+/, ''))
    );
    if (exactDefinition) {
      return exactDefinition.line;
    }

    const escapedPattern = normalizedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const simpleName = normalizedPattern.replace(/^(struct|class|enum)\s+/, '');
    const escapedSimpleName = simpleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const definitionPatterns = [
      new RegExp(`^\\s*(?:export\\s+)?(?:async\\s+)?function\\s+${escapedSimpleName}\\s*\\(`),
      new RegExp(
        `^\\s*(?:export\\s+)?(?:const|let|var)\\s+${escapedSimpleName}\\s*=\\s*(?:async\\s*)?\\(`
      ),
      new RegExp(
        `^\\s*(?:export\\s+)?(?:const|let|var)\\s+${escapedSimpleName}\\s*=\\s*(?:async\\s*)?[^=]*=>`
      ),
      new RegExp(`^\\s*(?:async\\s+)?def\\s+${escapedSimpleName}\\s*\\(`),
      new RegExp(`^\\s*fn\\s+${escapedSimpleName}\\s*\\(`),
      new RegExp(`^\\s*func\\s+${escapedSimpleName}\\s*\\(`),
      new RegExp(`^\\s*(?:COMPAT_)?SYSCALL_DEFINE\\d+\\s*\\(\\s*${escapedSimpleName}\\s*,?`),
      new RegExp(
        `^\\s*(?:[\\w~:*<>\\[\\],&]+\\s+)+${escapedSimpleName}\\s*\\([^;{}]*\\)\\s*(?:\\{|$)`
      ),
      new RegExp(`^\\s*${escapedPattern}\\s*\\{`),
      new RegExp(`^\\s*${escapedPattern}\\s*$`),
      new RegExp(`^\\s*typedef\\s+${escapedPattern}`),
    ];

    for (let i = 0; i < lines.length; i++) {
      for (const definitionPattern of definitionPatterns) {
        if (definitionPattern.test(lines[i])) {
          return i + 1;
        }
      }
    }

    if (simpleName !== normalizedPattern) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(simpleName) && lines[i].includes(normalizedPattern.split(' ')[0])) {
          return i + 1;
        }
      }
    }

    return -1;
  }, []);

  const getMonacoLanguage = useCallback((filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'c':
        return 'c';
      case 'h':
        return 'c';
      case 'cpp':
      case 'cc':
      case 'cxx':
        return 'cpp';
      case 'cs':
      case 'csx':
        return 'csharp';
      case 's':
      case 'S':
        return 'asm';
      case 'py':
        return 'python';
      case 'sh':
        return 'shell';
      case 'rs':
        return 'rust';
      case 'go':
        return 'go';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'json':
        return 'json';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'md':
        return 'plaintext';
      case 'txt':
        return 'plaintext';
      case 'Makefile':
      case 'makefile':
        return 'makefile';
      case 'Kconfig':
        return 'ini'; // Closest to Kconfig syntax
      default:
        return 'plaintext';
    }
  }, []);

  const language = useMemo(
    () => (filePath ? getMonacoLanguage(filePath) : 'text'),
    [filePath, getMonacoLanguage]
  );

  const getAnalyzedSymbolsForFile = useCallback(
    async (targetFilePath: string): Promise<SymbolReference[]> => {
      const cacheKey = buildWorkspaceCacheKey(workspaceId, targetFilePath);
      const cachedSymbols = workspaceSymbolsCache.get(cacheKey);
      if (cachedSymbols) {
        return cachedSymbols;
      }

      const targetContent =
        targetFilePath === filePath
          ? content
          : (workspaceContentsCache.get(cacheKey) ??
            (fetchFile ? (await fetchFile(targetFilePath)).content : ''));

      if (!targetContent) {
        return [];
      }

      workspaceContentsCache.set(cacheKey, targetContent);
      const parsedSymbols = findSymbolsInFile(targetContent, targetFilePath);
      workspaceSymbolsCache.set(cacheKey, parsedSymbols);
      return parsedSymbols;
    },
    [content, fetchFile, filePath, workspaceId]
  );

  const getWorkspaceFileContent = useCallback(
    async (targetFilePath: string): Promise<string> => {
      const cacheKey = buildWorkspaceCacheKey(workspaceId, targetFilePath);
      if (targetFilePath === filePath) {
        return content;
      }

      const cachedContent = workspaceContentsCache.get(cacheKey);
      if (cachedContent !== undefined) {
        return cachedContent;
      }

      if (!fetchFile) {
        return '';
      }

      const fetchedContent = (await fetchFile(targetFilePath)).content;
      workspaceContentsCache.set(cacheKey, fetchedContent);
      return fetchedContent;
    },
    [content, fetchFile, filePath, workspaceId]
  );

  const ensureMonacoModelForFile = useCallback(
    async (targetFilePath: string): Promise<unknown | null> => {
      const pendingModelCreation = monacoModelCreationPromisesRef.current.get(targetFilePath);
      if (pendingModelCreation) {
        return pendingModelCreation;
      }

      const monaco = monacoRef.current as {
        Uri: { parse: (value: string) => unknown };
        editor: {
          getModel: (uri: unknown) => { uri?: unknown } | null;
          createModel: (value: string, language?: string, uri?: unknown) => unknown;
        };
      } | null;

      if (!monaco || targetFilePath === filePath) {
        return null;
      }

      const uri = monaco.Uri.parse(`file:///${targetFilePath}`);
      const existingModel = monaco.editor.getModel(uri);
      if (existingModel) {
        return existingModel.uri ?? uri;
      }

      const creationPromise = (async () => {
        const targetContent = await getWorkspaceFileContent(targetFilePath);
        if (!targetContent) {
          return null;
        }

        const modelCreatedWhileFetching = monaco.editor.getModel(uri);
        if (modelCreatedWhileFetching) {
          return modelCreatedWhileFetching.uri ?? uri;
        }

        const createdModel = monaco.editor.createModel(
          targetContent,
          getMonacoLanguage(targetFilePath),
          uri
        ) as { uri?: unknown } | null;
        debugLog('[explorar:xref] created-reference-model', {
          filePath,
          targetFilePath,
        });
        return createdModel?.uri ?? uri;
      })().finally(() => {
        monacoModelCreationPromisesRef.current.delete(targetFilePath);
      });

      monacoModelCreationPromisesRef.current.set(targetFilePath, creationPromise);
      return creationPromise;
    },
    [filePath, getMonacoLanguage, getWorkspaceFileContent]
  );

  const resolveDefinitionHeuristically = useCallback(
    async (symbolName: string): Promise<SymbolReference | null> => {
      const normalizedSymbol = normalizeSymbolQuery(symbolName);
      const localDefinition =
        findDefinition(normalizedSymbol, symbolsRef.current) ??
        symbolsRef.current.find(
          (symbol) => symbol.isDefinition && normalizeSymbolQuery(symbol.name) === normalizedSymbol
        ) ??
        null;
      if (localDefinition?.isDefinition) {
        return localDefinition;
      }

      if (!fetchFile || workspaceFilePaths.length === 0) {
        return (
          symbolsRef.current.find(
            (symbol) => normalizeSymbolQuery(symbol.name) === normalizedSymbol
          ) ?? null
        );
      }

      const candidatePaths = rankWorkspaceCandidatePaths(
        symbolName,
        filePath,
        content,
        workspaceFilePaths
      );
      const maxFilesToSearch = Math.min(candidatePaths.length, 80);

      for (let i = 0; i < maxFilesToSearch; i++) {
        const candidatePath = candidatePaths[i];
        if (candidatePath === filePath) {
          continue;
        }

        try {
          const candidateSymbols = await getAnalyzedSymbolsForFile(candidatePath);
          const definition = findBestMatchingSymbolDefinition(symbolName, candidateSymbols);
          if (definition) {
            debugLog('[explorar:xref] resolved-workspace-definition', {
              symbolName,
              sourceFile: filePath,
              targetFile: definition.file,
              targetLine: definition.line,
              searchedFiles: i + 1,
            });
            return definition;
          }
        } catch (error) {
          debugLog('[explorar:xref] workspace-definition-error', {
            symbolName,
            sourceFile: filePath,
            candidatePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return (
        symbolsRef.current.find(
          (symbol) => normalizeSymbolQuery(symbol.name) === normalizedSymbol
        ) ?? null
      );
    },
    [content, fetchFile, filePath, getAnalyzedSymbolsForFile, workspaceFilePaths]
  );

  const findReferencesHeuristically = useCallback(
    async (symbolName: string, includeDeclaration: boolean): Promise<Location[]> => {
      const normalizedSymbol = normalizeSymbolQuery(symbolName);
      const referenceCacheKey = `${workspaceId}:${normalizedSymbol}:${includeDeclaration ? 'with-def' : 'refs-only'}`;
      const cachedReferences = workspaceReferencesCache.get(referenceCacheKey);
      if (cachedReferences) {
        return cachedReferences;
      }

      const pendingReferences = workspaceReferencesPromiseCache.get(referenceCacheKey);
      if (pendingReferences) {
        return pendingReferences;
      }

      const referencePromise = (async () => {
        const definition = await resolveDefinitionHeuristically(normalizedSymbol);
        const rankedCandidatePaths = rankReferenceCandidatePaths(
          normalizedSymbol,
          filePath,
          definition?.file,
          content,
          workspaceFilePaths
        );
        const filesToScan = rankedCandidatePaths.slice(0, 160);

        const references: Location[] = [];
        const batchSize = 12;

        for (let i = 0; i < filesToScan.length; i += batchSize) {
          const batch = filesToScan.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(async (candidatePath) => {
              try {
                const candidateContent = await getWorkspaceFileContent(candidatePath);
                if (!candidateContent) {
                  return [] as Location[];
                }

                const excludeDefinitionLine =
                  definition && candidatePath === definition.file ? definition.line : undefined;
                return findReferencesInContent(
                  normalizedSymbol,
                  candidateContent,
                  candidatePath,
                  includeDeclaration ? undefined : excludeDefinitionLine
                );
              } catch (error) {
                console.warn('[explorar:xref] workspace-reference-scan-file-failed', {
                  symbolName: normalizedSymbol,
                  sourceFile: filePath,
                  candidatePath,
                  error: error instanceof Error ? error.message : String(error),
                });
                return [] as Location[];
              }
            })
          );

          for (const matches of batchResults) {
            references.push(...matches);
          }
        }

        const dedupedReferences = Array.from(
          new Map(
            references.map((location) => [
              `${location.file}:${location.line}:${location.column}`,
              location,
            ])
          ).values()
        );

        if (includeDeclaration && definition) {
          dedupedReferences.unshift({
            file: definition.file,
            line: definition.line,
            column: definition.column,
          });
        }

        const uniqueReferenceFiles = Array.from(
          new Set(
            dedupedReferences
              .map((location) => location.file)
              .filter((candidatePath) => candidatePath && candidatePath !== filePath)
          )
        );

        await Promise.all(
          uniqueReferenceFiles.map(async (referenceFilePath) => {
            try {
              await ensureMonacoModelForFile(referenceFilePath);
            } catch (error) {
              console.warn('[explorar:xref] reference-model-create-failed', {
                filePath,
                referenceFilePath,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          })
        );

        debugLog('[explorar:xref] workspace-references-ready', {
          symbolName: normalizedSymbol,
          sourceFile: filePath,
          includeDeclaration,
          fileCountScanned: filesToScan.length,
          totalRankedCandidates: rankedCandidatePaths.length,
          referenceCount: dedupedReferences.length,
          uniqueReferenceFileCount: uniqueReferenceFiles.length,
          sampleReferences: dedupedReferences.slice(0, 5),
        });

        workspaceReferencesCache.set(referenceCacheKey, dedupedReferences);
        return dedupedReferences;
      })().finally(() => {
        workspaceReferencesPromiseCache.delete(referenceCacheKey);
      });

      workspaceReferencesPromiseCache.set(referenceCacheKey, referencePromise);
      return referencePromise;
    },
    [
      ensureMonacoModelForFile,
      filePath,
      content,
      getWorkspaceFileContent,
      resolveDefinitionHeuristically,
      workspaceFilePaths,
      workspaceId,
    ]
  );

  const getHeuristicHover = useCallback(async (symbolName: string) => {
    const definition = findBestMatchingSymbolDefinition(symbolName, symbolsRef.current);
    return definition
      ? {
          markdown: [
            `**${symbolName}** \`${definition.type}\``,
            ...(definition.signature ? ['```c\n' + definition.signature + '\n```'] : []),
            ...(definition.documentation ? [`*${definition.documentation}*`] : []),
          ],
        }
      : null;
  }, []);

  const getHeuristicDocumentSymbols = useCallback(async () => symbolsRef.current, []);

  const backendRegistry = useMemo(() => {
    const registry = new LanguageBackendRegistry();
    registry.register(new IndexedLanguageBackend(codeIndex));
    return registry;
  }, [codeIndex]);

  const createHeuristicBackend = useCallback(
    () =>
      new HeuristicLanguageBackend({
        getDefinition: async (symbolName: string) => {
          const definition = await resolveDefinitionHeuristically(symbolName);
          return definition ? symbolReferenceToBackendDefinition(definition) : null;
        },
        getReferences: async (symbolName: string, context: LanguageBackendContext) =>
          findReferencesHeuristically(symbolName, Boolean(context.includeDeclaration)),
        getHover: getHeuristicHover,
        getDiagnostics: async () => [],
        getDocumentSymbols: getHeuristicDocumentSymbols,
      }),
    [
      findReferencesHeuristically,
      getHeuristicDocumentSymbols,
      getHeuristicHover,
      resolveDefinitionHeuristically,
    ]
  );

  const backendContext = useMemo(
    (): LanguageBackendContext => ({
      filePath,
      content,
      workspaceFilePaths,
    }),
    [content, filePath, workspaceFilePaths]
  );

  const resolveDefinitionAcrossWorkspace = useCallback(
    async (symbolName: string): Promise<SymbolReference | null> => {
      for (const backend of [...backendRegistry.getBackends(language), createHeuristicBackend()]) {
        const definition = await backend.getDefinition(symbolName, backendContext);
        if (definition) {
          return backendDefinitionToSymbolReference(definition);
        }
      }
      return null;
    },
    [backendContext, backendRegistry, createHeuristicBackend, language]
  );

  const findReferencesAcrossWorkspace = useCallback(
    async (symbolName: string, includeDeclaration: boolean): Promise<Location[]> => {
      const context = { ...backendContext, includeDeclaration };
      const allReferences: Location[] = [];
      for (const backend of [...backendRegistry.getBackends(language), createHeuristicBackend()]) {
        const references = await backend.getReferences(symbolName, context);
        allReferences.push(...references);
      }

      const dedupedReferences = Array.from(
        new Map(
          allReferences.map((reference) => [
            `${reference.file}:${reference.line}:${reference.column}`,
            reference,
          ])
        ).values()
      );

      const uniqueReferenceFiles = Array.from(
        new Set(
          dedupedReferences
            .map((location) => location.file)
            .filter((candidatePath) => candidatePath && candidatePath !== filePath)
        )
      );
      await Promise.all(
        uniqueReferenceFiles.map(async (referenceFilePath) => {
          try {
            await ensureMonacoModelForFile(referenceFilePath);
          } catch (error) {
            console.warn('[explorar:xref] reference-model-create-failed', {
              filePath,
              referenceFilePath,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })
      );

      return dedupedReferences;
    },
    [
      backendContext,
      backendRegistry,
      createHeuristicBackend,
      ensureMonacoModelForFile,
      filePath,
      language,
    ]
  );

  const navigateToDefinition = useCallback(
    async (symbolName: string): Promise<boolean> => {
      const definition = await resolveDefinitionAcrossWorkspace(symbolName);
      if (!definition) {
        return false;
      }

      if (definition.file === filePath) {
        revealTargetLine(definition.line, content.split('\n'));
        return true;
      }

      onOpenFile?.(definition.file, undefined, definition.line);
      return true;
    },
    [content, filePath, onOpenFile, resolveDefinitionAcrossWorkspace, revealTargetLine]
  );

  const jumpToReference = useCallback(
    (reference: XrefReferenceItem) => {
      setXrefPanelState((currentState) =>
        currentState
          ? {
              ...currentState,
              selectedReferenceKey: reference.key,
            }
          : currentState
      );

      if (reference.file === filePath) {
        revealTargetLine(reference.line, content.split('\n'));
        return;
      }

      onOpenFile?.(reference.file, undefined, reference.line);
    },
    [content, filePath, onOpenFile, revealTargetLine]
  );

  const openReferencesPanelForSymbol = useCallback(
    async (symbolName: string, currentLine?: number): Promise<boolean> => {
      const normalizedSymbol = normalizeSymbolQuery(symbolName);
      if (!normalizedSymbol) {
        return false;
      }

      setXrefPanelState((currentState) => ({
        symbolName: normalizedSymbol,
        references:
          currentState?.symbolName === normalizedSymbol
            ? currentState.references
            : ([] as XrefReferenceItem[]),
        selectedReferenceKey:
          currentState?.symbolName === normalizedSymbol ? currentState.selectedReferenceKey : null,
        isLoading: true,
        error: null,
      }));

      try {
        const references = await findReferencesAcrossWorkspace(normalizedSymbol, true);
        const uniqueFiles = Array.from(
          new Set(references.map((reference) => reference.file).filter(Boolean))
        );
        const fileContents = new Map<string, string>();

        await Promise.all(
          uniqueFiles.map(async (referenceFilePath) => {
            const referenceContent =
              referenceFilePath === filePath
                ? content
                : await getWorkspaceFileContent(referenceFilePath);
            fileContents.set(referenceFilePath, referenceContent);
          })
        );

        const referenceItems = Array.from(
          new Map(
            references.map((reference) => {
              const referenceContent = fileContents.get(reference.file) ?? '';
              const referenceLine = referenceContent.split('\n')[reference.line - 1] ?? '';
              const key = `${reference.file}:${reference.line}:${reference.column}`;

              return [
                key,
                {
                  ...reference,
                  key,
                  preview: referenceLine.trim() || '(empty line)',
                  fileName: getPathBasename(reference.file),
                  directory: getPathDirectory(reference.file),
                },
              ] as const;
            })
          ).values()
        );

        const preferredReference =
          referenceItems.find(
            (reference) =>
              reference.file === filePath && (!currentLine || reference.line === currentLine)
          ) ??
          referenceItems[0] ??
          null;

        setXrefPanelState({
          symbolName: normalizedSymbol,
          references: referenceItems,
          selectedReferenceKey: preferredReference?.key ?? null,
          isLoading: false,
          error: null,
        });

        debugLog('[explorar:xref] panel-opened', {
          currentFilePath: filePath,
          symbolName: normalizedSymbol,
          referenceCount: referenceItems.length,
          selectedReferenceKey: preferredReference?.key ?? null,
        });

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load references';
        setXrefPanelState({
          symbolName: normalizedSymbol,
          references: [],
          selectedReferenceKey: null,
          isLoading: false,
          error: errorMessage,
        });
        return false;
      }
    },
    [content, filePath, findReferencesAcrossWorkspace, getWorkspaceFileContent]
  );

  const openReferencesPanelAtCursor = useCallback(async (): Promise<boolean> => {
    const editor = editorRef.current as {
      getModel?: () => {
        getWordAtPosition: (position: {
          lineNumber: number;
          column: number;
        }) => { word: string } | null;
      } | null;
      getPosition?: () => { lineNumber: number; column: number } | null;
    } | null;

    const model = editor?.getModel?.();
    const position = editor?.getPosition?.();
    if (!model || !position) {
      return false;
    }

    const word = model.getWordAtPosition(position);
    if (!word) {
      return false;
    }

    return openReferencesPanelForSymbol(word.word, position.lineNumber);
  }, [openReferencesPanelForSymbol]);

  const latestEditorActionsRef = useRef({
    navigateToDefinition,
    openReferencesPanelAtCursor,
    openReferencesPanelForSymbol,
  });

  useEffect(() => {
    latestEditorActionsRef.current = {
      navigateToDefinition,
      openReferencesPanelAtCursor,
      openReferencesPanelForSymbol,
    };
  }, [navigateToDefinition, openReferencesPanelAtCursor, openReferencesPanelForSymbol]);

  const selectedXrefReference = useMemo(
    () =>
      xrefPanelState?.references.find(
        (reference) => reference.key === xrefPanelState.selectedReferenceKey
      ) ??
      xrefPanelState?.references[0] ??
      null,
    [xrefPanelState]
  );

  const groupedXrefReferences = useMemo(() => {
    if (!xrefPanelState) {
      return [];
    }

    const groupedReferences = new Map<
      string,
      {
        file: string;
        fileName: string;
        directory: string;
        references: XrefReferenceItem[];
      }
    >();

    for (const reference of xrefPanelState.references) {
      const existingGroup = groupedReferences.get(reference.file);
      if (existingGroup) {
        existingGroup.references.push(reference);
        continue;
      }

      groupedReferences.set(reference.file, {
        file: reference.file,
        fileName: reference.fileName,
        directory: reference.directory,
        references: [reference],
      });
    }

    return Array.from(groupedReferences.values());
  }, [xrefPanelState]);

  const syncMonacoTestApi = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const targetWindow = window as Window & {
      __explorarTestApi?: MonacoTestApi;
    };

    targetWindow.__explorarTestApi = {
      getActiveFilePath: () => filePath,
      focusSymbol: async (symbol: string) => {
        const editor = editorRef.current as {
          getModel?: () => {
            getValue: () => string;
          } | null;
          setPosition?: (position: { lineNumber: number; column: number }) => void;
          revealLineInCenter?: (lineNumber: number) => void;
          focus?: () => void;
        } | null;

        const model = editor?.getModel?.();
        const contentValue = model?.getValue();
        if (
          !editor ||
          !model ||
          !contentValue ||
          !editor.setPosition ||
          !editor.revealLineInCenter
        ) {
          return false;
        }

        const lines = contentValue.split('\n');
        for (let index = 0; index < lines.length; index += 1) {
          const columnIndex = lines[index].indexOf(symbol);
          if (columnIndex !== -1) {
            const lineNumber = index + 1;
            const column = columnIndex + 1;
            editor.revealLineInCenter(lineNumber);
            editor.setPosition({ lineNumber, column });
            editor.focus?.();
            return true;
          }
        }

        return false;
      },
      showReferencesAtCursor: async () => {
        return openReferencesPanelAtCursor();
      },
      closeReferencesWidget: async () => {
        if (!xrefPanelState) {
          return false;
        }
        setXrefPanelState(null);
        return true;
      },
      goToDefinitionAtCursor: async () => {
        const editor = editorRef.current as {
          getModel?: () => {
            getWordAtPosition: (position: {
              lineNumber: number;
              column: number;
            }) => { word: string } | null;
          } | null;
          getPosition?: () => { lineNumber: number; column: number } | null;
        } | null;

        const model = editor?.getModel?.();
        const position = editor?.getPosition?.();
        const word = model?.getWordAtPosition(position ?? { lineNumber: 1, column: 1 });
        if (!word) {
          return false;
        }

        return navigateToDefinition(word.word);
      },
    };
  }, [filePath, navigateToDefinition, openReferencesPanelAtCursor, xrefPanelState]);

  // Keep the live Monaco model synchronized with async-loaded content.
  // The React wrapper does not reliably repaint in this app when content
  // arrives after mount for an already-open model.
  useEffect(() => {
    const editor = editorRef.current as MonacoEditorLike | null;
    const model = editor?.getModel();
    if (!model) {
      if (content) {
        debugLog('[explorar:monaco] sync-skipped-no-model', {
          filePath,
          contentLength: content.length,
        });
      }
      return;
    }

    if (contentFilePath && contentFilePath !== filePath) {
      debugLog('[explorar:monaco] sync-skipped-stale-content', {
        filePath,
        contentFilePath,
        contentLength: content.length,
      });
      return;
    }

    const existingValue = model.getValue();
    if (existingValue !== content) {
      debugLog('[explorar:monaco] model-sync', {
        filePath,
        previousLength: existingValue.length,
        nextLength: content.length,
        preview: content.slice(0, 80),
      });
      model.setValue(content);
    } else {
      debugLog('[explorar:monaco] model-already-synced', {
        filePath,
        contentLength: content.length,
      });
    }
  }, [content, contentFilePath, filePath]);

  useEffect(() => {
    syncMonacoTestApi();
  }, [syncMonacoTestApi]);

  useEffect(
    () => () => {
      if (typeof window !== 'undefined') {
        const targetWindow = window as Window & {
          __explorarTestApi?: MonacoTestApi;
        };
        delete targetWindow.__explorarTestApi;
      }
    },
    []
  );

  const isLicenseHeaderComment = useCallback((commentText: string, isXnuFile: boolean): boolean => {
    const normalized = commentText.toLowerCase();

    const genericLicenseMarkers = [
      'license',
      'copyright',
      'spdx-license-identifier',
      'permission is hereby granted',
      'all rights reserved',
    ];

    if (genericLicenseMarkers.some((marker) => normalized.includes(marker))) {
      return true;
    }

    if (!isXnuFile) {
      return false;
    }

    const xnuSpecificMarkers = [
      '@apple_osreference_license_header_start@',
      '@apple_osreference_license_header_end@',
      '@osf_copyright@',
      'apple public source license',
      'original code and/or modifications of original code',
      'carnegie mellon university',
      'the regents of the university of california',
      'notice: this file was modified by sparta',
      'notice: this file was modified by mcafee research',
      'support for mandatory and extensible security protections',
      'mach operating system',
    ];

    return xnuSpecificMarkers.some((marker) => normalized.includes(marker));
  }, []);

  const getAutoFoldRanges = useCallback((): Array<{
    start: number;
    end: number;
    kind?: string;
    isLicenseHeader?: boolean;
  }> => {
    if (!content) {
      return [];
    }

    const fileName = filePath.toLowerCase();
    const isXnuFile =
      fileName.startsWith('osfmk/') ||
      fileName.startsWith('bsd/') ||
      fileName.startsWith('libkern/') ||
      fileName.startsWith('libsa/') ||
      fileName.startsWith('libsyscall/') ||
      fileName.startsWith('security/') ||
      fileName.startsWith('pexpert/') ||
      fileName.startsWith('iokit/') ||
      fileName.startsWith('san/') ||
      fileName.startsWith('tests/');
    const isCLike =
      language === 'c' ||
      language === 'cpp' ||
      fileName.endsWith('.h') ||
      fileName.endsWith('.hpp') ||
      fileName.endsWith('.hh') ||
      fileName.endsWith('.hxx') ||
      fileName.endsWith('.S');

    const lines = content.split('\n');
    const ranges: Array<{ start: number; end: number; kind?: string; isLicenseHeader?: boolean }> =
      [];

    let current = 0;
    while (current < lines.length && lines[current].trim() === '') {
      current++;
    }

    const firstCodeLine = current + 1;

    if (current < lines.length) {
      let headerStart = -1;
      let headerEnd = -1;
      let scan = current;

      while (scan < lines.length) {
        while (scan < lines.length && lines[scan].trim() === '') {
          scan++;
        }
        if (scan >= lines.length) {
          break;
        }

        const first = lines[scan].trim();
        if (!first.startsWith('/*') && !first.startsWith('/**')) {
          break;
        }

        let commentEnd = scan;
        if (!first.includes('*/')) {
          for (let i = scan + 1; i < lines.length; i++) {
            commentEnd = i;
            if (lines[i].includes('*/')) {
              break;
            }
          }
        }

        const commentText = lines.slice(scan, commentEnd + 1).join('\n');
        if (!isLicenseHeaderComment(commentText, isXnuFile)) {
          break;
        }

        if (headerStart === -1) {
          headerStart = scan;
        }
        headerEnd = commentEnd;
        scan = commentEnd + 1;
      }

      if (headerStart !== -1 && headerEnd > headerStart) {
        ranges.push({
          start: headerStart + 1,
          end: headerEnd + 1,
          kind: 'comment',
          isLicenseHeader: true,
        });
      }
    }

    if (isCLike) {
      let includeStart = -1;
      let includeEnd = -1;
      let inTopBlock = true;

      for (let i = firstCodeLine - 1; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
          if (includeStart !== -1) {
            break;
          }
          continue;
        }

        if (trimmed.startsWith('#pragma once') || trimmed.startsWith('#pragma')) {
          if (includeStart !== -1) {
            includeEnd = i + 1;
            continue;
          }
          continue;
        }

        if (trimmed.startsWith('#include')) {
          if (includeStart === -1) {
            includeStart = i + 1;
          }
          includeEnd = i + 1;
          continue;
        }

        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          if (includeStart !== -1) {
            break;
          }
          continue;
        }

        if (inTopBlock && includeStart !== -1) {
          break;
        }

        inTopBlock = false;
      }

      if (includeStart !== -1 && includeEnd > includeStart) {
        ranges.push({ start: includeStart, end: includeEnd, kind: 'imports' });
      }
    }

    return ranges;
  }, [content, filePath, isLicenseHeaderComment, language]);

  // Force Monaco to relayout whenever its flex container changes size.
  useEffect(() => {
    const layoutEditor = () => {
      if (!containerRef.current || !editorRef.current) return;

      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth === 0 || clientHeight === 0) return;

      type LayoutableEditor = {
        layout: (dimension?: { width: number; height: number }) => void;
      };

      (editorRef.current as LayoutableEditor).layout({
        width: clientWidth,
        height: clientHeight,
      });
    };

    const timeoutId = window.setTimeout(layoutEditor, 0);
    const animationFrameId = window.requestAnimationFrame(layoutEditor);
    const resizeObserver = new ResizeObserver(layoutEditor);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', layoutEditor);

    return () => {
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', layoutEditor);
    };
  }, []);

  // Extract symbols from content when it changes
  useEffect(() => {
    if (content && filePath && isIndexableSourceFile(filePath)) {
      const parsedSymbols = findSymbolsInFile(content, filePath);
      symbolsRef.current = parsedSymbols;
      const cacheKey = buildWorkspaceCacheKey(workspaceId, filePath);
      workspaceContentsCache.set(cacheKey, content);
      workspaceSymbolsCache.set(cacheKey, parsedSymbols);
    } else {
      symbolsRef.current = [];
    }
  }, [content, filePath, workspaceId]);

  // Search for pattern and scroll to it
  useEffect(() => {
    if (hasMountedEditor && editorRef.current && searchPattern && content) {
      setTimeout(() => {
        const lines = content.split('\n');
        const targetLine = findDefinitionLineForPattern(searchPattern, lines);
        debugLog('[explorar:monaco-jump] resolve-search-pattern', {
          filePath,
          searchPattern,
          targetLine,
          symbolCount: symbolsRef.current.length,
          fallbackScrollToLine: scrollToLine,
        });

        if (targetLine !== -1) {
          revealTargetLine(targetLine, lines);
        } else if (scrollToLine) {
          revealTargetLine(scrollToLine, lines);
        }
      }, 200);
    }
  }, [
    searchPattern,
    content,
    scrollToLine,
    navigationNonce,
    filePath,
    hasMountedEditor,
    findDefinitionLineForPattern,
    revealTargetLine,
  ]);

  // Scroll to specific line when scrollToLine changes (fallback)
  useEffect(() => {
    if (hasMountedEditor && editorRef.current && scrollToLine && content && !searchPattern) {
      setTimeout(() => {
        debugLog('[explorar:monaco-jump] direct-line', {
          filePath,
          scrollToLine,
        });
        revealTargetLine(scrollToLine, content.split('\n'));
      }, 200);
    }
  }, [
    scrollToLine,
    content,
    searchPattern,
    filePath,
    navigationNonce,
    hasMountedEditor,
    revealTargetLine,
  ]);

  // Reset scroll position to top when file path changes (unless we have scrollToLine or searchPattern)
  useEffect(() => {
    if (editorRef.current && filePath && content && !scrollToLine && !searchPattern) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editor = editorRef.current as any;
      setTimeout(() => {
        editor.revealLineInCenter(1);
        editor.setPosition({ lineNumber: 1, column: 1 });
      }, 100);
    }
  }, [filePath, content, scrollToLine, searchPattern]);

  // Note: onContentLoad is handled by CodeEditorContainer, not here

  const handleEditorDidMount = useCallback(
    async (editor: unknown, monaco: unknown) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      setHasMountedEditor(true);
      syncMonacoTestApi();
      debugLog('[explorar:monaco] mount', {
        filePath,
        language,
        contentLength: content.length,
      });

      // Configure Monaco Editor to use local workers
      configureMonacoWorkers();

      // Configure editor options
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).updateOptions({
        fontSize: 14,
        fontFamily:
          "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', Consolas, monospace",
        lineNumbers: 'on',
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        wordWrap: 'off',
        readOnly: true, // Read-only for now since we're just viewing
        automaticLayout: true,
        theme: 'vs-dark',
        renderWhitespace: 'selection',
        showFoldingControls: 'always',
        folding: true,
        foldingStrategy: 'indentation',
        matchBrackets: 'always',
        renderLineHighlight: 'line',
        selectOnLineNumbers: true,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        find: {
          addExtraSpaceOnTop: false,
          autoFindInSelection: 'never',
          seedSearchStringFromSelection: 'always',
        },
      });

      // Track cursor position changes for status bar
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).onDidChangeCursorPosition((e: any) => {
        if (onCursorChange) {
          onCursorChange(e.position.lineNumber, e.position.column);
        }
      });

      // Initialize cursor position
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const position = (editor as any).getPosition();
      if (position && onCursorChange) {
        onCursorChange(position.lineNumber, position.column);
      }

      // Add keyboard shortcuts
      // Monaco Editor types are not fully exposed via @monaco-editor/react
      // Using type assertions for Monaco's internal API
      type MonacoEditor = typeof editor & {
        addCommand: (keybinding: number, handler: () => void) => string | null;
        addAction: (descriptor: {
          id: string;
          label: string;
          run: (_editor: unknown, symbolName?: string, symbolLine?: number) => Promise<void> | void;
        }) => void;
        getAction: (actionId: string) => { run: () => Promise<void> } | null;
      };
      type MonacoInstance = typeof monaco & {
        KeyMod: { CtrlCmd: number; Shift: number };
        KeyCode: { KeyF: number };
      };

      (editor as MonacoEditor).addCommand(
        ((monaco as MonacoInstance).KeyMod.CtrlCmd |
          (monaco as MonacoInstance).KeyCode.KeyF) as number,
        () => {
          (editor as MonacoEditor).getAction('actions.find')?.run();
        }
      );

      (editor as MonacoEditor).addAction({
        id: 'explorar.showReferences',
        label: 'Show References',
        run: async (_activeEditor, symbolName?: string, symbolLine?: number) => {
          if (symbolName) {
            await latestEditorActionsRef.current.openReferencesPanelForSymbol(
              symbolName,
              symbolLine
            );
            return;
          }

          await latestEditorActionsRef.current.openReferencesPanelAtCursor();
        },
      });

      (editor as MonacoEditor).addCommand(
        ((monaco as MonacoInstance).KeyMod.CtrlCmd |
          (monaco as MonacoInstance).KeyMod.Shift |
          (monaco as MonacoInstance).KeyCode.KeyF) as number,
        () => {
          (editor as MonacoEditor).getAction('editor.action.startFindReplaceAction')?.run();
        }
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).addCommand((monaco as any).KeyCode.F3, () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).getAction('editor.action.nextMatchFindAction')?.run();
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).addCommand((monaco as any).KeyMod.Shift | (monaco as any).KeyCode.F3, () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).getAction('editor.action.previousMatchFindAction')?.run();
      });

      // Add Shift+F12 for Find All References
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).addCommand((monaco as any).KeyMod.Shift | (monaco as any).KeyCode.F12, () => {
        void latestEditorActionsRef.current.openReferencesPanelAtCursor();
      });

      // Override F12 with app-aware cross-file navigation.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).addCommand((monaco as any).KeyCode.F12, () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model = (editor as any).getModel();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const position = (editor as any).getPosition();
        if (!model || !position) {
          return;
        }

        const word = model.getWordAtPosition(position);
        if (!word) {
          return;
        }

        void latestEditorActionsRef.current.navigateToDefinition(word.word);
      });

      // Add Ctrl+Click to go to definition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).onMouseDown((e: any) => {
        if (e.event.ctrlKey || e.event.metaKey) {
          const position = e.target.position;
          if (!position) return;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const model = (editor as any).getModel();
          const word = model.getWordAtPosition(position);
          if (!word) return;

          e.event.preventDefault();
          void latestEditorActionsRef.current.navigateToDefinition(word.word);
        }
      });

      requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;
        (editor as { layout: (dimension?: { width: number; height: number }) => void }).layout({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      });
    },
    [content, filePath, language, onCursorChange, syncMonacoTestApi]
  );

  useEffect(() => {
    if (!hasMountedEditor || !monacoRef.current) {
      return;
    }

    const monaco = monacoRef.current as {
      editor: {
        registerCommand: (
          id: string,
          handler: (accessor: unknown, ...args: unknown[]) => void
        ) => { dispose: () => void };
      };
      languages: MonacoLanguageApi & {
        registerHoverProvider: (
          languageSelector: string,
          provider: Record<string, unknown>
        ) => { dispose: () => void };
        registerReferenceProvider: (
          languageSelector: string,
          provider: Record<string, unknown>
        ) => { dispose: () => void };
        registerDefinitionProvider: (
          languageSelector: string,
          provider: Record<string, unknown>
        ) => { dispose: () => void };
        registerCodeLensProvider: (
          languageSelector: string,
          provider: Record<string, unknown>
        ) => { dispose: () => void };
      };
      Range: new (
        startLineNumber: number,
        startColumn: number,
        endLineNumber: number,
        endColumn: number
      ) => unknown;
      Uri: { parse: (value: string) => unknown };
    };

    type MonacoPosition = { lineNumber: number; column: number };
    type MonacoWord = {
      word: string;
      startColumn: number;
      endColumn: number;
    };
    type MonacoModelLike = {
      getWordAtPosition: (position: MonacoPosition) => MonacoWord | null;
      uri: unknown;
    };

    disposeRegisteredProviders();

    const registerLSPProviders = (lang: string) => {
      providerDisposablesRef.current.push(
        monaco.languages.registerHoverProvider(lang, {
          provideHover: async (model: MonacoModelLike, position: MonacoPosition) => {
            const word = model.getWordAtPosition(position);
            if (!word) return null;

            const symbolName = word.word;
            for (const backend of backendRegistry.getBackends(language)) {
              const hover = await backend.getHover(symbolName, backendContext);
              if (hover) {
                return {
                  range: new monaco.Range(
                    position.lineNumber,
                    word.startColumn,
                    position.lineNumber,
                    word.endColumn
                  ),
                  contents: hover.markdown.map((value) => ({ value })),
                };
              }
            }

            const definition = findBestMatchingSymbolDefinition(symbolName, symbolsRef.current);
            const allRefs = findAllReferences(symbolName, symbolsRef.current);
            const usageCount = allRefs.length;

            if (definition) {
              const contents: Array<{ value: string }> = [];

              contents.push({
                value: `**${symbolName}** \`${definition.type}\``,
              });

              if (definition.type === 'function' && definition.signature) {
                contents.push({
                  value: '```c\n' + definition.signature + '\n```',
                });
              } else if (
                (definition.type === 'struct' || definition.type === 'class') &&
                definition.members
              ) {
                if (definition.members.length > 0) {
                  const membersList = definition.members
                    .slice(0, 10)
                    .map((m) => `  ${m.type} ${m.name};`)
                    .join('\n');
                  const moreText =
                    definition.members.length > 10
                      ? `\n  // ... ${definition.members.length - 10} more`
                      : '';
                  contents.push({
                    value: '```c\n' + membersList + moreText + '\n```',
                  });
                }
              }

              if (definition.documentation) {
                contents.push({
                  value: `*${definition.documentation}*`,
                });
              }

              contents.push({
                value: `**${usageCount}** reference${usageCount !== 1 ? 's' : ''} found`,
              });

              if (definition.relatedSymbols.length > 0) {
                const relatedList = definition.relatedSymbols.slice(0, 5).join(', ');
                const moreRelated =
                  definition.relatedSymbols.length > 5
                    ? ` +${definition.relatedSymbols.length - 5} more`
                    : '';
                contents.push({
                  value: `*Related: ${relatedList}${moreRelated}*`,
                });
              }

              contents.push({
                value: `${definition.isDefinition ? '📍' : '📝'} Line ${definition.line} in ${definition.file.split('/').pop()}`,
              });

              return {
                range: new monaco.Range(
                  position.lineNumber,
                  word.startColumn,
                  position.lineNumber,
                  word.endColumn
                ),
                contents,
              };
            }

            return null;
          },
        })
      );

      providerDisposablesRef.current.push(
        monaco.languages.registerReferenceProvider(lang, {
          provideReferences: async (
            model: {
              getWordAtPosition: (position: {
                lineNumber: number;
                column: number;
              }) => { word: string } | null;
              uri: unknown;
            },
            position: { lineNumber: number; column: number },
            context: { includeDeclaration?: boolean }
          ) => {
            const word = model.getWordAtPosition(position);
            if (!word) return [];

            const symbolName = word.word;
            try {
              const references = await findReferencesAcrossWorkspace(
                symbolName,
                Boolean(context?.includeDeclaration)
              );
              const providerReferences = await Promise.all(
                references.map(async (ref) => {
                  const uri =
                    ref.file === filePath ? model.uri : await ensureMonacoModelForFile(ref.file);
                  if (!uri) {
                    return null;
                  }

                  return {
                    uri,
                    range: new monaco.Range(
                      ref.line,
                      ref.column,
                      ref.line,
                      ref.column + symbolName.length
                    ),
                  };
                })
              );

              debugLog('[explorar:xref] provide-references', {
                filePath,
                symbolName,
                includeDeclaration: Boolean(context?.includeDeclaration),
                referenceCount: references.length,
                sampleReferences: references.slice(0, 5),
              });

              return providerReferences.filter((ref): ref is NonNullable<typeof ref> => !!ref);
            } catch (error) {
              console.error('[explorar:xref] provide-references-failed', {
                filePath,
                symbolName,
                includeDeclaration: Boolean(context?.includeDeclaration),
                error: error instanceof Error ? error.message : String(error),
              });

              const fallbackReferences = findAllReferences(symbolName, symbolsRef.current);
              return fallbackReferences.map((ref) => ({
                uri: model.uri,
                range: new monaco.Range(
                  ref.line,
                  ref.column,
                  ref.line,
                  ref.column + symbolName.length
                ),
              }));
            }
          },
        })
      );

      providerDisposablesRef.current.push(
        monaco.languages.registerDefinitionProvider(lang, {
          provideDefinition: async (model: MonacoModelLike, position: MonacoPosition) => {
            const word = model.getWordAtPosition(position);
            if (!word) return [];

            try {
              const symbolName = word.word;
              const definition = await resolveDefinitionAcrossWorkspace(symbolName);

              if (!definition) {
                return [];
              }

              const uri =
                definition.file === filePath
                  ? model.uri
                  : await ensureMonacoModelForFile(definition.file);
              if (!uri) {
                return [];
              }

              return [
                {
                  uri,
                  range: new monaco.Range(
                    definition.line,
                    definition.column,
                    definition.line,
                    definition.column + definition.name.length
                  ),
                },
              ];
            } catch (error) {
              console.warn('[explorar:xref] provide-definition-failed', {
                filePath,
                error: error instanceof Error ? error.message : String(error),
              });
              return [];
            }
          },
        })
      );

      providerDisposablesRef.current.push(
        monaco.languages.registerCodeLensProvider(lang, {
          provideCodeLenses: async (_model: MonacoModelLike) => {
            const lenses: Array<{
              range: unknown;
              id: string;
              command: undefined;
            }> = [];

            for (const symbol of symbolsRef.current) {
              if (!symbol.isDefinition) {
                continue;
              }

              const normalizedSymbol = normalizeSymbolQuery(symbol.name);
              const cachedWorkspaceReferences = workspaceReferencesCache.get(
                `${workspaceId}:${normalizedSymbol}:refs-only`
              );
              const refCount =
                cachedWorkspaceReferences?.length ??
                (symbol.references.length > 0
                  ? symbol.references.length
                  : (await findReferencesAcrossWorkspace(symbol.name, false)).length);

              if (refCount > 0) {
                lenses.push({
                  range: new monaco.Range(symbol.line, 1, symbol.line, 1),
                  id: `lens-${symbol.name}-${symbol.line}`,
                  command: undefined,
                });
              }
            }

            debugLog('[explorar:xref] provide-code-lenses', {
              filePath,
              lensCount: lenses.length,
              symbolCount: symbolsRef.current.length,
            });

            return {
              lenses,
              dispose: () => {},
            };
          },
          resolveCodeLens: async (
            model: MonacoModelLike,
            codeLens: { id: string; command?: { id: string; title: string; arguments?: unknown[] } }
          ) => {
            const symbolName = codeLens.id.replace(/^lens-/, '').replace(/-\d+$/, '');
            const symbol = symbolsRef.current.find((s) => s.name === symbolName && s.isDefinition);
            if (!symbol) {
              return codeLens;
            }

            const references = await findReferencesAcrossWorkspace(symbol.name, false);
            debugLog('[explorar:xref] resolve-code-lens', {
              filePath,
              symbolName: symbol.name,
              symbolLine: symbol.line,
              referenceCount: references.length,
              sampleLocations: references.slice(0, 5),
            });

            codeLens.command = {
              id: 'explorar.showReferences',
              title: `${references.length} reference${references.length !== 1 ? 's' : ''}`,
              arguments: [symbol.name, symbol.line],
            };

            return codeLens;
          },
        })
      );
    };

    providerDisposablesRef.current.push(
      monaco.editor.registerCommand('explorar.showReferences', async (_accessor, ...args) => {
        const [symbolName, symbolLine] = args as [string | undefined, number | undefined];
        if (symbolName) {
          await latestEditorActionsRef.current.openReferencesPanelForSymbol(symbolName, symbolLine);
          return;
        }

        await latestEditorActionsRef.current.openReferencesPanelAtCursor();
      })
    );

    if (backendRegistry.getBackends(language).length > 0) {
      registerLSPProviders(language);
    }

    const foldingRanges = getAutoFoldRanges();
    if (foldingRanges.length > 0) {
      const monacoLanguages = monaco.languages;
      providerDisposablesRef.current.push(
        monacoLanguages.registerFoldingRangeProvider(language, {
          provideFoldingRanges: () =>
            foldingRanges.map((range) => ({
              start: range.start,
              end: range.end,
              kind:
                range.kind === 'comment'
                  ? monacoLanguages.FoldingRangeKind.Comment
                  : monacoLanguages.FoldingRangeKind.Imports,
            })),
        })
      );

      const licenseHeader = foldingRanges.find((range) => range.isLicenseHeader);
      if (licenseHeader) {
        requestAnimationFrame(() => {
          const foldAction = (editorRef.current as MonacoEditorLike)?.getAction('editor.fold');
          void foldAction?.run();
        });
      }
    }

    return disposeRegisteredProviders;
  }, [
    backendContext,
    backendRegistry,
    content,
    disposeRegisteredProviders,
    ensureMonacoModelForFile,
    filePath,
    findReferencesAcrossWorkspace,
    getAutoFoldRanges,
    hasMountedEditor,
    language,
    resolveDefinitionAcrossWorkspace,
    workspaceFilePaths,
    workspaceId,
  ]);

  if (isLoading && !content && !hasMountedEditor) {
    return (
      <div className="vscode-editor">
        <div className="vscode-loading">
          <div className="vscode-spinner" />
          <div>Loading {filePath}...</div>
        </div>
      </div>
    );
  }

  if (!content && !isLoading) {
    return (
      <div className="vscode-editor">
        <div className="vscode-empty-state">
          <div className="vscode-empty-icon">📄</div>
          <div>No file selected</div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>
            Select a file from the explorer to view its contents
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vscode-editor">
      {/* Monaco Editor */}
      <div
        ref={containerRef}
        className="explorar-editor-shell"
        style={{
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Editor
          path={filePath}
          height="100%"
          width="100%"
          language={language}
          value={content}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            readOnly: true,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            minimap: { enabled: true },
            fontSize: 14,
            fontFamily:
              "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', Consolas, monospace",
            lineNumbers: 'on',
            wordWrap: 'off',
            renderWhitespace: 'selection',
            showFoldingControls: 'always',
            folding: true,
            matchBrackets: 'always',
            renderLineHighlight: 'line',
            selectOnLineNumbers: true,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
          }}
        />
        {xrefPanelState && (
          <aside className="explorar-xref-panel" aria-label="Cross references">
            <div className="explorar-xref-panel-header">
              <div className="explorar-xref-panel-title-wrap">
                <div className="explorar-xref-panel-label">Cross References</div>
                <div className="explorar-xref-panel-title">
                  {xrefPanelState.symbolName}
                  {!xrefPanelState.isLoading && (
                    <span className="explorar-xref-panel-count">
                      {xrefPanelState.references.length}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="explorar-xref-panel-close"
                aria-label="Close cross references"
                onClick={() => setXrefPanelState(null)}
              >
                ✕
              </button>
            </div>
            <div className="explorar-xref-panel-subtitle">
              {selectedXrefReference
                ? `${selectedXrefReference.fileName}:${selectedXrefReference.line}`
                : 'Select a reference to jump.'}
            </div>
            <div className="explorar-xref-panel-body">
              {xrefPanelState.isLoading ? (
                <div className="explorar-xref-panel-empty">Loading references…</div>
              ) : xrefPanelState.error ? (
                <div className="explorar-xref-panel-empty">{xrefPanelState.error}</div>
              ) : xrefPanelState.references.length === 0 ? (
                <div className="explorar-xref-panel-empty">No references found.</div>
              ) : (
                groupedXrefReferences.map((group) => (
                  <section key={group.file} className="explorar-xref-group">
                    <header className="explorar-xref-group-header">
                      <div className="explorar-xref-group-file">{group.fileName}</div>
                      <div className="explorar-xref-group-dir">{group.directory || 'root'}</div>
                    </header>
                    <div className="explorar-xref-group-list">
                      {group.references.map((reference) => (
                        <button
                          key={reference.key}
                          type="button"
                          className={`explorar-xref-row${
                            reference.key === selectedXrefReference?.key ? ' is-selected' : ''
                          }`}
                          onClick={() => jumpToReference(reference)}
                        >
                          <span className="explorar-xref-row-line">L{reference.line}</span>
                          <span className="explorar-xref-row-preview">{reference.preview}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default MonacoCodeEditor;

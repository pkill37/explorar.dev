'use client';

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  findSymbolsInFile,
  findDefinition,
  findAllReferences,
  type SymbolReference,
} from '@/lib/cross-reference';
import { configureMonacoEnvironment as configureMonacoWorkers } from '@/lib/monaco-config';
import { debugLog } from '@/lib/browser-debug';

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
  isLoading: boolean;
  scrollToLine?: number;
  searchPattern?: string;
  onCursorChange?: (line: number, column: number) => void;
}

type MonacoEditorLike = {
  layout: (dimension?: { width: number; height: number }) => void;
  updateOptions: (options: Record<string, unknown>) => void;
  getModel: () => {
    getValue: () => string;
    setValue: (value: string) => void;
  } | null;
  onDidChangeCursorPosition: (
    listener: (e: { position: { lineNumber: number; column: number } }) => void
  ) => void;
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
  ) => void;
};

const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = ({
  filePath,
  content,
  isLoading,
  scrollToLine,
  searchPattern,
  onCursorChange,
}) => {
  const editorRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const decorationsRef = useRef<string[]>([]);
  const symbolsRef = useRef<SymbolReference[]>([]);

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
        return 'javascript';
      case 'ts':
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
  const editorInstanceKey = useMemo(
    () => `${filePath}:${content.length}:${isLoading ? 'loading' : 'ready'}`,
    [content.length, filePath, isLoading]
  );

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
  }, [content, filePath]);

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
    if (
      content &&
      filePath &&
      (filePath.endsWith('.c') ||
        filePath.endsWith('.h') ||
        filePath.endsWith('.cpp') ||
        filePath.endsWith('.cc') ||
        filePath.endsWith('.cxx') ||
        filePath.endsWith('.hpp') ||
        filePath.endsWith('.S'))
    ) {
      symbolsRef.current = findSymbolsInFile(content, filePath);
    } else {
      symbolsRef.current = [];
    }
  }, [content, filePath]);

  // Search for pattern and scroll to it
  useEffect(() => {
    if (editorRef.current && searchPattern && content) {
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
    filePath,
    findDefinitionLineForPattern,
    revealTargetLine,
  ]);

  // Scroll to specific line when scrollToLine changes (fallback)
  useEffect(() => {
    if (editorRef.current && scrollToLine && content && !searchPattern) {
      setTimeout(() => {
        debugLog('[explorar:monaco-jump] direct-line', {
          filePath,
          scrollToLine,
        });
        revealTargetLine(scrollToLine, content.split('\n'));
      }, 200);
    }
  }, [scrollToLine, content, searchPattern, filePath, revealTargetLine]);

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

      // Add F12 for Go to Definition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).addCommand((monaco as any).KeyCode.F12, () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).getAction('editor.action.revealDefinition')?.run();
      });

      // Add Shift+F12 for Find All References
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).addCommand((monaco as any).KeyMod.Shift | (monaco as any).KeyCode.F12, () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).getAction('editor.action.goToReferences')?.run();
      });

      // Register LSP providers for C and C++
      const registerLSPProviders = (lang: string) => {
        // Rich hover provider
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (monaco as any).languages.registerHoverProvider(lang, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          provideHover: (model: any, position: any) => {
            const word = model.getWordAtPosition(position);
            if (!word) return null;

            const symbolName = word.word;
            const definition = findDefinition(symbolName, symbolsRef.current);
            const allRefs = findAllReferences(symbolName, symbolsRef.current);
            const usageCount = allRefs.length;

            if (definition) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const contents: any[] = [];

              // Header with symbol name and type
              contents.push({
                value: `**${symbolName}** \`${definition.type}\``,
              });

              // Function signature or struct info
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

              // Documentation
              if (definition.documentation) {
                contents.push({
                  value: `*${definition.documentation}*`,
                });
              }

              // Usage statistics
              contents.push({
                value: `**${usageCount}** reference${usageCount !== 1 ? 's' : ''} found`,
              });

              // Related symbols
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

              // Location info
              contents.push({
                value: `${definition.isDefinition ? '📍' : '📝'} Line ${definition.line} in ${definition.file.split('/').pop()}`,
              });

              return {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                range: new (monaco as any).Range(
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
        });

        // Reference provider for "Find All References"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (monaco as any).languages.registerReferenceProvider(lang, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          provideReferences: (model: any, position: any) => {
            const word = model.getWordAtPosition(position);
            if (!word) return [];

            const symbolName = word.word;
            const references = findAllReferences(symbolName, symbolsRef.current);

            return references.map((ref) => ({
              uri: model.uri,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              range: new (monaco as any).Range(
                ref.line,
                ref.column,
                ref.line,
                ref.column + symbolName.length
              ),
            }));
          },
        });

        // Definition provider for "Go to Definition" (F12)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (monaco as any).languages.registerDefinitionProvider(lang, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          provideDefinition: (model: any, position: any) => {
            const word = model.getWordAtPosition(position);
            if (!word) return [];

            const symbolName = word.word;
            const definition = findDefinition(symbolName, symbolsRef.current);

            if (definition) {
              return [
                {
                  uri: model.uri,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  range: new (monaco as any).Range(
                    definition.line,
                    definition.column,
                    definition.line,
                    definition.column + definition.name.length
                  ),
                },
              ];
            }

            return [];
          },
        });

        // Code lens provider for reference counts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (monaco as any).languages.registerCodeLensProvider(lang, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          provideCodeLenses: (_model: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const lenses: any[] = [];

            for (const symbol of symbolsRef.current) {
              if (symbol.isDefinition) {
                const refCount = symbol.references.length;
                if (refCount > 0) {
                  lenses.push({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    range: new (monaco as any).Range(symbol.line, 1, symbol.line, 1),
                    id: `lens-${symbol.name}-${symbol.line}`,
                    command: {
                      id: '',
                      title: `${refCount} reference${refCount !== 1 ? 's' : ''}`,
                    },
                  });
                }
              }
            }

            return {
              lenses,
              dispose: () => {},
            };
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resolveCodeLens: (model: any, codeLens: any) => {
            // When code lens is clicked, show references
            if (codeLens.command && codeLens.command.title) {
              const symbolName = codeLens.id.replace(/^lens-/, '').replace(/-\d+$/, '');
              const symbol = symbolsRef.current.find(
                (s) => s.name === symbolName && s.isDefinition
              );
              if (symbol) {
                codeLens.command = {
                  id: 'editor.action.goToReferences',
                  title: codeLens.command.title,
                  arguments: [
                    model.uri,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    new (monaco as any).Position(symbol.line, symbol.column),
                  ],
                };
              }
            }
            return codeLens;
          },
        });
      };

      // Register providers for C and C++
      if (language === 'c' || language === 'cpp') {
        registerLSPProviders(language);
      }

      const foldingRanges = getAutoFoldRanges();
      if (foldingRanges.length > 0) {
        const monacoLanguages = (monaco as { languages: MonacoLanguageApi }).languages;
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
        });

        const licenseHeader = foldingRanges.find((range) => range.isLicenseHeader);
        if (licenseHeader) {
          requestAnimationFrame(() => {
            const foldAction = (editor as MonacoEditorLike).getAction('editor.fold');
            void foldAction?.run();
          });
        }
      }

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

          const symbolName = word.word;
          const definition = findDefinition(symbolName, symbolsRef.current);

          if (definition) {
            // Scroll to definition in current file
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor as any).revealLineInCenter(definition.line);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor as any).setPosition({
              lineNumber: definition.line,
              column: definition.column,
            });
            e.event.preventDefault();
          }
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
    [content.length, filePath, getAutoFoldRanges, language, onCursorChange]
  );

  if (isLoading && !content) {
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
        style={{
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Editor
          key={editorInstanceKey}
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
      </div>
    </div>
  );
};

export default MonacoCodeEditor;

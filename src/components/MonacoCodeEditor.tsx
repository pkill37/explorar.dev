'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  findSymbolsInFile,
  findDefinition,
  findAllReferences,
  type SymbolReference,
} from '@/lib/cross-reference';
import { configureMonacoEnvironment as configureMonacoWorkers } from '@/lib/monaco-config';

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
  const [language, setLanguage] = useState<string>('text');
  const decorationsRef = useRef<string[]>([]);
  const symbolsRef = useRef<SymbolReference[]>([]);

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

  // Update language when file path changes
  useEffect(() => {
    if (filePath) {
      const detectedLanguage = getMonacoLanguage(filePath);
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setLanguage(detectedLanguage);
      }, 0);
    }
  }, [filePath, getMonacoLanguage]);

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
      const first = lines[current].trim();
      if (first.startsWith('/*') || first.startsWith('/**')) {
        let end = current;

        if (first.includes('*/')) {
          end = current;
        } else {
          for (let i = current + 1; i < lines.length; i++) {
            end = i;
            if (lines[i].includes('*/')) {
              break;
            }
          }
        }

        if (end > current) {
          const headerText = lines
            .slice(current, end + 1)
            .join('\n')
            .toLowerCase();
          const looksLikeLicenseHeader =
            headerText.includes('license') ||
            headerText.includes('copyright') ||
            headerText.includes('spdx-license-identifier') ||
            headerText.includes('permission is hereby granted') ||
            headerText.includes('all rights reserved');

          if (looksLikeLicenseHeader) {
            ranges.push({ start: 1, end: end + 1, kind: 'comment', isLicenseHeader: true });
          }
        }
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
  }, [content, filePath, language]);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editor = editorRef.current as any;

      setTimeout(() => {
        // Search for the struct definition
        const lines = content.split('\n');
        let targetLine = -1;

        // Try different patterns to find the struct
        const patterns = [
          new RegExp(`^\\s*${searchPattern.replace(/\s+/g, '\\s+')}\\s*\\{`, 'm'), // struct name {
          new RegExp(`^\\s*${searchPattern.replace(/\s+/g, '\\s+')}\\s*$`, 'm'), // struct name alone
          new RegExp(`^\\s*typedef\\s+${searchPattern.replace(/\s+/g, '\\s+')}`, 'm'), // typedef struct
        ];

        for (let i = 0; i < lines.length; i++) {
          for (const pattern of patterns) {
            if (pattern.test(lines[i])) {
              targetLine = i + 1; // Monaco uses 1-based line numbers
              break;
            }
          }
          if (targetLine !== -1) break;
        }

        // If not found, try a simpler search for just the struct name
        if (targetLine === -1) {
          const structName = searchPattern.replace('struct ', '');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(structName) && lines[i].includes('struct')) {
              targetLine = i + 1;
              break;
            }
          }
        }

        if (targetLine !== -1) {
          // Clear previous decorations
          if (decorationsRef.current.length > 0) {
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
          }

          // Scroll to the line
          editor.revealLineInCenter(targetLine);
          editor.setPosition({ lineNumber: targetLine, column: 1 });

          // Highlight the line
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
        }
      }, 200);
    }
  }, [searchPattern, content]);

  // Scroll to specific line when scrollToLine changes (fallback)
  useEffect(() => {
    if (editorRef.current && scrollToLine && content && !searchPattern) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editor = editorRef.current as any;
      setTimeout(() => {
        // Clear previous decorations
        if (decorationsRef.current.length > 0) {
          decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
        }

        editor.revealLineInCenter(scrollToLine);
        editor.setPosition({ lineNumber: scrollToLine, column: 1 });

        // Highlight the line
        decorationsRef.current = editor.deltaDecorations(
          [],
          [
            {
              range: {
                startLineNumber: scrollToLine,
                startColumn: 1,
                endLineNumber: scrollToLine,
                endColumn: 1,
              },
              options: {
                isWholeLine: true,
                className: 'highlight-line',
                glyphMarginClassName: 'highlight-line-glyph',
              },
            },
          ]
        );
      }, 200);
    }
  }, [scrollToLine, content, searchPattern]);

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
    [getAutoFoldRanges, language, onCursorChange]
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

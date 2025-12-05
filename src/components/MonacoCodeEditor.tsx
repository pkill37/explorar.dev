'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { findSymbolsInFile, findDefinition, type SymbolReference } from '@/lib/cross-reference';

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
  repoLabel?: string;
  scrollToLine?: number;
  searchPattern?: string;
  onCursorChange?: (line: number, column: number) => void;
}

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
  const [editorHeight, setEditorHeight] = useState<number>(600);
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

  // Calculate and update editor height based on container
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        if (height > 0) {
          setEditorHeight(height);
        }
      }
    };

    // Initial height calculation with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(updateHeight, 100);
    
    // Use ResizeObserver to track container size changes
    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', updateHeight);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  // Extract symbols from content when it changes
  useEffect(() => {
    if (
      content &&
      filePath &&
      (filePath.endsWith('.c') || filePath.endsWith('.h') || filePath.endsWith('.S'))
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

      // Configure Monaco Editor to use CDN for workers
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).MonacoEnvironment = {
          getWorkerUrl: function (moduleId: string, label: string) {
            if (label === 'json') {
              return `https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/language/json/json.worker.js`;
            }
            if (label === 'css' || label === 'scss' || label === 'less') {
              return `https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/language/css/css.worker.js`;
            }
            if (label === 'html' || label === 'handlebars' || label === 'razor') {
              return `https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/language/html/html.worker.js`;
            }
            if (label === 'typescript' || label === 'javascript') {
              return `https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/language/typescript/ts.worker.js`;
            }
            return `https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/editor/editor.worker.js`;
          },
        };
      }

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

      // Add hover provider for cross-referencing
      if (language === 'c') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (monaco as any).languages.registerHoverProvider('c', {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          provideHover: (model: any, position: any) => {
            const word = model.getWordAtPosition(position);
            if (!word) return null;

            const symbolName = word.word;
            const definition = findDefinition(symbolName, symbolsRef.current);

            if (definition) {
              return {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                range: new (monaco as any).Range(
                  position.lineNumber,
                  word.startColumn,
                  position.lineNumber,
                  word.endColumn
                ),
                contents: [
                  { value: `**${symbolName}** (${definition.type})` },
                  { value: definition.isDefinition ? '📍 Definition' : '📝 Declaration' },
                  { value: `Line ${definition.line} in ${definition.file.split('/').pop()}` },
                ],
              };
            }

            return null;
          },
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
      }
    },
    [language, onCursorChange]
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
        style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <Editor
          height={editorHeight}
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

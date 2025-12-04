'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
  const [language, setLanguage] = useState<string>('text');
  const [userWantsPreview, setUserWantsPreview] = useState<boolean>(false);
  const decorationsRef = useRef<string[]>([]);
  const symbolsRef = useRef<SymbolReference[]>([]);

  // Get filename for README detection
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';

  // Check if file supports preview (markdown)
  const supportsPreview =
    filePath.endsWith('.md') || filePath.endsWith('.mdx') || fileName === 'readme';

  // Derived state: preview mode is only enabled if user wants it AND file supports it
  const isPreviewMode = userWantsPreview && supportsPreview;

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
        return 'markdown';
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

  // Keyboard shortcut handler for Cmd+Shift+V / Ctrl+Shift+V
  useEffect(() => {
    if (!supportsPreview) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        setUserWantsPreview((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [supportsPreview]);

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
      {/* Preview toggle button - floating */}
      {supportsPreview && (
        <button
          onClick={() => setUserWantsPreview(!userWantsPreview)}
          className="preview-toggle-button"
          title={`${isPreviewMode ? 'Show source' : 'Show preview'} (Cmd+Shift+V)`}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 10,
            padding: '4px 8px',
            fontSize: '11px',
            background: isPreviewMode ? 'var(--vscode-text-accent)' : 'var(--vscode-bg-tertiary)',
            color: isPreviewMode ? 'white' : 'var(--vscode-text-primary)',
            border: `1px solid ${isPreviewMode ? 'var(--vscode-text-accent)' : 'var(--vscode-border)'}`,
            borderRadius: '3px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => {
            if (!isPreviewMode) {
              e.currentTarget.style.background = 'var(--vscode-bg-hover)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isPreviewMode) {
              e.currentTarget.style.background = 'var(--vscode-bg-tertiary)';
            }
          }}
        >
          {isPreviewMode ? '📄 Source' : '👁️ Preview'}
        </button>
      )}

      {/* Monaco Editor or Preview */}
      <div style={{ flex: 1, overflow: 'hidden', height: '100%', minHeight: '300px' }}>
        {isPreviewMode && supportsPreview ? (
          <div
            className="markdown-preview"
            style={{
              height: '100%',
              overflow: 'auto',
              padding: '24px',
              background: 'var(--vscode-editor-background, #1e1e1e)',
              color: 'var(--vscode-editor-foreground, #d4d4d4)',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontSize: '14px',
              lineHeight: '1.6',
            }}
          >
            {fileName === 'readme' || filePath.endsWith('.md') || filePath.endsWith('.mdx') ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children, ...props }) => (
                    <h1
                      style={{
                        fontSize: '2em',
                        fontWeight: 600,
                        marginTop: '24px',
                        marginBottom: '16px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid var(--vscode-border)',
                        color: 'var(--vscode-text-primary)',
                      }}
                      {...props}
                    >
                      {children}
                    </h1>
                  ),
                  h2: ({ children, ...props }) => (
                    <h2
                      style={{
                        fontSize: '1.5em',
                        fontWeight: 600,
                        marginTop: '20px',
                        marginBottom: '12px',
                        paddingBottom: '6px',
                        borderBottom: '1px solid var(--vscode-border)',
                        color: 'var(--vscode-text-primary)',
                      }}
                      {...props}
                    >
                      {children}
                    </h2>
                  ),
                  h3: ({ children, ...props }) => (
                    <h3
                      style={{
                        fontSize: '1.25em',
                        fontWeight: 600,
                        marginTop: '16px',
                        marginBottom: '8px',
                        color: 'var(--vscode-text-primary)',
                      }}
                      {...props}
                    >
                      {children}
                    </h3>
                  ),
                  h4: ({ children, ...props }) => (
                    <h4
                      style={{
                        fontSize: '1.1em',
                        fontWeight: 600,
                        marginTop: '14px',
                        marginBottom: '6px',
                        color: 'var(--vscode-text-primary)',
                      }}
                      {...props}
                    >
                      {children}
                    </h4>
                  ),
                  p: ({ children, ...props }) => (
                    <p
                      style={{
                        marginBottom: '12px',
                        lineHeight: '1.6',
                        color: 'var(--vscode-text-primary)',
                      }}
                      {...props}
                    >
                      {children}
                    </p>
                  ),
                  code: ({
                    inline,
                    className,
                    children,
                    ...props
                  }: React.ComponentPropsWithoutRef<'code'> & {
                    inline?: boolean;
                  }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const codeString = String(children).replace(/\n$/, '');

                    if (!inline && language) {
                      return (
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={language}
                          PreTag="div"
                          customStyle={{
                            margin: '12px 0',
                            borderRadius: '4px',
                            border: '1px solid var(--vscode-border)',
                            background: 'var(--vscode-bg-secondary)',
                          }}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      );
                    }

                    if (inline) {
                      return (
                        <code
                          style={{
                            background:
                              'var(--vscode-textBlockQuote-background, rgba(100, 150, 200, 0.1))',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '0.9em',
                            fontFamily: 'monospace',
                            color: 'var(--syntax-keyword, #569cd6)',
                          }}
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }

                    return (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language="text"
                        PreTag="div"
                        customStyle={{
                          margin: '12px 0',
                          borderRadius: '4px',
                          border: '1px solid var(--vscode-border)',
                          background: 'var(--vscode-bg-secondary)',
                        }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    );
                  },
                  pre: ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => {
                    return <pre {...props}>{children}</pre>;
                  },
                  a: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
                    <a
                      href={href}
                      style={{
                        color: 'var(--vscode-textLink-foreground, #4a9eff)',
                        textDecoration: 'none',
                      }}
                      {...props}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.textDecoration = 'none';
                      }}
                    >
                      {children}
                    </a>
                  ),
                  ul: ({ children, ...props }) => (
                    <ul
                      style={{
                        marginLeft: '20px',
                        marginBottom: '12px',
                        color: 'var(--vscode-text-primary)',
                      }}
                      {...props}
                    >
                      {children}
                    </ul>
                  ),
                  ol: ({ children, ...props }) => (
                    <ol
                      style={{
                        marginLeft: '20px',
                        marginBottom: '12px',
                        color: 'var(--vscode-text-primary)',
                      }}
                      {...props}
                    >
                      {children}
                    </ol>
                  ),
                  li: ({ children, ...props }) => (
                    <li style={{ marginBottom: '4px' }} {...props}>
                      {children}
                    </li>
                  ),
                  blockquote: ({ children, ...props }) => (
                    <blockquote
                      style={{
                        borderLeft: '4px solid var(--vscode-text-accent)',
                        paddingLeft: '16px',
                        marginLeft: '0',
                        marginTop: '12px',
                        marginBottom: '12px',
                        color: 'var(--vscode-text-secondary)',
                        fontStyle: 'italic',
                      }}
                      {...props}
                    >
                      {children}
                    </blockquote>
                  ),
                  table: ({ children, ...props }) => (
                    <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
                      <table
                        style={{
                          borderCollapse: 'collapse',
                          width: '100%',
                          border: '1px solid var(--vscode-border)',
                        }}
                        {...props}
                      >
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children, ...props }) => (
                    <th
                      style={{
                        border: '1px solid var(--vscode-border)',
                        padding: '8px',
                        background: 'var(--vscode-bg-tertiary)',
                        fontWeight: 600,
                        textAlign: 'left',
                        color: 'var(--vscode-text-primary)',
                      }}
                      {...props}
                    >
                      {children}
                    </th>
                  ),
                  td: ({ children, ...props }) => (
                    <td
                      style={{
                        border: '1px solid var(--vscode-border)',
                        padding: '8px',
                        color: 'var(--vscode-text-primary)',
                      }}
                      {...props}
                    >
                      {children}
                    </td>
                  ),
                  hr: ({ ...props }) => (
                    <hr
                      style={{
                        border: 'none',
                        borderTop: '1px solid var(--vscode-border)',
                        margin: '24px 0',
                      }}
                      {...props}
                    />
                  ),
                  img: ({ src, alt, ...props }: React.ComponentPropsWithoutRef<'img'>) => {
                    // Convert src to string if it's a Blob
                    const srcString =
                      typeof src === 'string'
                        ? src
                        : src instanceof Blob
                          ? URL.createObjectURL(src)
                          : undefined;
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={srcString}
                        alt={alt}
                        style={{
                          maxWidth: '100%',
                          height: 'auto',
                          borderRadius: '4px',
                          margin: '12px 0',
                        }}
                        {...props}
                      />
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            ) : null}
          </div>
        ) : (
          <Editor
            height="100%"
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
        )}
      </div>
    </div>
  );
};

export default MonacoCodeEditor;

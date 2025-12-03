'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { generateKernelMarkers, generateKernelAnnotations, MARKER_COLORS, MARKER_ICONS, type KernelMarker, type KernelAnnotation } from '@/lib/kernel-markers';


// Dynamically import Monaco Editor to avoid SSR issues
const Editor = dynamic(
  () => import('@monaco-editor/react'),
  { 
    ssr: false,
    loading: () => (
      <div className="vscode-loading">
        <div className="vscode-spinner" />
        <div>Loading kernel study editor...</div>
      </div>
    )
  }
);

interface KernelStudyEditorProps {
  filePath: string;
  content: string;
  isLoading: boolean;
  repoLabel?: string;
  scrollToLine?: number;
  searchPattern?: string;
  onCursorChange?: (line: number, column: number) => void;
}

const KernelStudyEditor: React.FC<KernelStudyEditorProps> = ({ 
  filePath, 
  content, 
  isLoading,
  scrollToLine,
  searchPattern,
  onCursorChange
}) => {
  const editorRef = useRef<unknown>(null);
  const monacoRef = useRef<unknown>(null);
  const [language, setLanguage] = useState<string>('text');
  const [markers, setMarkers] = useState<KernelMarker[]>([]);
  const [annotations, setAnnotations] = useState<KernelAnnotation[]>([]);
  const decorationsRef = useRef<string[]>([]);

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
        return 'ini';
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
          new RegExp(`^\\s*${searchPattern.replace(/\s+/g, '\\s+')}\\s*$`, 'm'),   // struct name alone
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
          decorationsRef.current = editor.deltaDecorations([], [{
            range: {
              startLineNumber: targetLine,
              startColumn: 1,
              endLineNumber: targetLine,
              endColumn: lines[targetLine - 1]?.length || 1
            },
            options: {
              isWholeLine: true,
              className: 'highlight-line',
              glyphMarginClassName: 'highlight-line-glyph'
            }
          }]);
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
        decorationsRef.current = editor.deltaDecorations([], [{
          range: {
            startLineNumber: scrollToLine,
            startColumn: 1,
            endLineNumber: scrollToLine,
            endColumn: 1
          },
          options: {
            isWholeLine: true,
            className: 'highlight-line',
            glyphMarginClassName: 'highlight-line-glyph'
          }
        }]);
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

  // Generate markers and annotations when content changes
  useEffect(() => {
    if (content && filePath) {
      const generatedMarkers = generateKernelMarkers(content);
      const generatedAnnotations = generateKernelAnnotations(content);
      
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setMarkers(generatedMarkers);
        setAnnotations(generatedAnnotations);
      }, 0);
    }
  }, [content, filePath]);

  const updateEditorDecorations = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) return;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = editorRef.current as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monaco = monacoRef.current as any;
    
    // Create decorations for all markers
    const decorations = markers.map(marker => ({
      range: new monaco.Range(marker.startLine, 1, marker.endLine, 1),
      options: {
        isWholeLine: true,
        className: `kernel-marker kernel-marker-${marker.type}`,
        glyphMarginClassName: `kernel-glyph kernel-glyph-${marker.type}`,
        glyphMarginHoverMessage: {
          value: `${MARKER_ICONS[marker.type]} **${marker.title}**\n\n${marker.description}\n\n*${marker.kernelMindChapter || 'Kernel Concept'}*`
        },
        minimap: {
          color: MARKER_COLORS[marker.type],
          position: monaco.editor.MinimapPosition.Inline
        },
        overviewRuler: {
          color: MARKER_COLORS[marker.type],
          position: monaco.editor.OverviewRulerLane.Right
        }
      }
    }));

    // Apply decorations
    editor.deltaDecorations([], decorations);
  }, [markers]);

  // Update editor decorations when markers change
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      updateEditorDecorations();
    }
  }, [updateEditorDecorations]);

  const handleEditorDidMount = useCallback(async (editor: unknown, monaco: unknown) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
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
        }
      };
    }
    
    // Configure editor options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).updateOptions({
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', Consolas, monospace",
      lineNumbers: 'on',
      minimap: { enabled: true, showSlider: 'always' },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      readOnly: true,
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
      glyphMargin: true,
      lineNumbersMinChars: 6,
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: 'never',
        seedSearchStringFromSelection: 'always',
      }
    });

    // Add hover provider for kernel markers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (monaco as any).languages.registerHoverProvider(language, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provideHover: (model: any, position: any) => {
        const lineNumber = position.lineNumber;
        const marker = markers.find(m => 
          lineNumber >= m.startLine && lineNumber <= m.endLine
        );
        
        if (marker) {
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            range: new (monaco as any).Range(marker.startLine, 1, marker.endLine, 1),
            contents: [
              { value: `**${marker.title}**` },
              { value: marker.description },
              { value: `*${marker.kernelMindChapter || 'Kernel Concept'}*` },
              { value: `Tags: ${marker.tags.join(', ')}` }
            ]
          };
        }
        
        const annotation = annotations.find(a => a.line === lineNumber);
        if (annotation) {
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            range: new (monaco as any).Range(lineNumber, 1, lineNumber, 1),
            contents: [
              { value: `${annotation.icon} **${annotation.type.toUpperCase()}**` },
              { value: annotation.text }
            ]
          };
        }
        
        return null;
      }
    });

    // Add context menu items for kernel study
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).addAction({
      id: 'explain-kernel-concept',
      label: 'Explain Kernel Concept',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      keybindings: [(monaco as any).KeyMod.CtrlCmd | (monaco as any).KeyCode.KeyH],
      run: () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const position = (editor as any).getPosition();
        if (position) {
          const marker = markers.find(m => 
            position.lineNumber >= m.startLine && position.lineNumber <= m.endLine
          );
          if (marker) {
            alert(`${marker.title}\n\n${marker.description}\n\nReference: ${marker.kernelMindChapter}`);
          }
        }
      }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).addCommand((monaco as any).KeyMod.CtrlCmd | (monaco as any).KeyCode.KeyF, () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).getAction('actions.find')?.run();
    });

    // Update decorations after mount
    updateEditorDecorations();
  }, [markers, annotations, language, updateEditorDecorations, onCursorChange]);

  const getFileSize = (content: string): string => {
    const bytes = new TextEncoder().encode(content).length;
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getLineCount = (content: string): number => {
    return content ? content.split('\n').length : 0;
  };


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
            Select a kernel file from the explorer to view with study annotations
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vscode-editor kernel-study-editor">
      {/* File header with kernel study controls */}
      <div className="vscode-editor-header">
        <span>{language.toUpperCase()}</span>
        <span>•</span>
        <span>{filePath}</span>
        {isLoading && (
          <div className="vscode-spinner" style={{ width: '12px', height: '12px', marginLeft: '8px' }} />
        )}
        
        {/* File info */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', opacity: 0.8 }}>
            {getLineCount(content)} lines • {getFileSize(content)}
          </span>
        </div>
      </div>

      {/* Monaco Editor with kernel study features */}
      <div style={{ flex: 1, overflow: 'hidden', height: '100%', minHeight: '300px' }}>
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
            minimap: { enabled: true, showSlider: 'always' },
            fontSize: 14,
            fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', Consolas, monospace",
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
            glyphMargin: true,
            lineNumbersMinChars: 6,
            overviewRulerLanes: 3,
          }}
        />
      </div>


      {/* Custom CSS for kernel markers */}
      <style jsx>{`
        .kernel-study-editor :global(.kernel-marker-data_structure) {
          background-color: rgba(255, 107, 53, 0.1);
          border-left: 3px solid #ff6b35;
        }
        .kernel-study-editor :global(.kernel-marker-routine) {
          background-color: rgba(78, 205, 196, 0.1);
          border-left: 3px solid #4ecdc4;
        }
        .kernel-study-editor :global(.kernel-marker-syscall) {
          background-color: rgba(108, 92, 231, 0.1);
          border-left: 3px solid #6c5ce7;
        }
        .kernel-study-editor :global(.kernel-marker-interrupt) {
          background-color: rgba(225, 112, 85, 0.1);
          border-left: 3px solid #e17055;
        }
        .kernel-study-editor :global(.kernel-marker-lock) {
          background-color: rgba(255, 234, 167, 0.1);
          border-left: 3px solid #ffeaa7;
        }
        .kernel-study-editor :global(.kernel-marker-context_switch) {
          background-color: rgba(253, 121, 168, 0.1);
          border-left: 3px solid #fd79a8;
        }
        .kernel-study-editor :global(.kernel-marker-concept) {
          background-color: rgba(69, 183, 209, 0.1);
          border-left: 3px solid #45b7d1;
        }
        .kernel-study-editor :global(.kernel-glyph-data_structure::before) {
          content: '📋';
          color: #ff6b35;
        }
        .kernel-study-editor :global(.kernel-glyph-routine::before) {
          content: '⚙️';
          color: #4ecdc4;
        }
        .kernel-study-editor :global(.kernel-glyph-syscall::before) {
          content: '🌉';
          color: #6c5ce7;
        }
        .kernel-study-editor :global(.kernel-glyph-interrupt::before) {
          content: '⚡';
          color: #e17055;
        }
        .kernel-study-editor :global(.kernel-glyph-lock::before) {
          content: '🔐';
          color: #ffeaa7;
        }
        .kernel-study-editor :global(.kernel-glyph-context_switch::before) {
          content: '🔄';
          color: #fd79a8;
        }
        .kernel-study-editor :global(.kernel-glyph-concept::before) {
          content: '💡';
          color: #45b7d1;
        }
      `}</style>
    </div>
  );
};

export default KernelStudyEditor;

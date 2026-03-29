'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, useViewport } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { FileNodeData } from '@/lib/graph-data';
import type { FileSymbols } from '@/lib/code-analysis';
import { useGraphContext } from '@/contexts/GraphContext';
import { ENTRY_ZOOM_THRESHOLD, ENTRY_APPROACH_START } from './ZoomWatcher';

export type FileNodeType = Node<FileNodeData, 'fileNode'>;

const LANG_BADGE: Record<string, string> = {
  c: 'C',
  cpp: 'C++',
  python: 'Py',
  rust: 'Rs',
  javascript: 'JS',
  typescript: 'TS',
  tsx: 'TSX',
  go: 'Go',
  asm: 'Asm',
  rst: 'RST',
  markdown: 'MD',
  bash: 'sh',
  text: '?',
};

// Fetch the first N lines of a file from the public static directory
async function fetchPreviewLines(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  maxLines = 28
): Promise<string | null> {
  try {
    const url = `/repos/${owner}/${repo}/${branch}/${filePath}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const text = await res.text();
    return text.split('\n').slice(0, maxLines).join('\n');
  } catch {
    return null;
  }
}

// Deterministic fake skeleton bars for when real code isn't loaded yet
function getSkeletonLines(
  filePath: string
): Array<{ width: number; color: string; indent: number }> {
  const hash = filePath.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0);
  const abs = Math.abs(hash);
  const comment = '#6a9955';
  const keyword = '#569cd6';
  const def = '#d4d4d4';
  const string = '#ce9178';
  const number = '#b5cea8';
  const type = '#4ec9b0';

  return Array.from({ length: 14 }, (_, i) => {
    const seed = Math.abs((abs + i * 37) % 100);
    let color = def;
    let indent = 0;
    if (seed < 8) color = comment;
    else if (seed < 18) color = keyword;
    else if (seed < 30) color = type;
    else if (seed < 50) indent = 1;
    else if (seed < 65) {
      indent = 2;
      color = string;
    } else if (seed < 78) {
      indent = 1;
      color = number;
    } else indent = seed % 3;
    const w = 25 + Math.abs((abs + i * 19) % 55);
    return { width: w, color, indent };
  });
}

// — LOD 1: Tiny dot (very low zoom) —
function NodeTiny({ data }: { data: FileNodeData }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: `${data.color}1a`,
        border: `2px solid ${data.color}`,
        borderRadius: 6,
      }}
    />
  );
}

// — LOD 2: Compact card (medium zoom) —
function NodeCompact({ data }: { data: FileNodeData }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'rgba(28,28,30,0.97)',
        borderTop: `3px solid ${data.color}`,
        borderRight: `1px solid ${data.color}44`,
        borderBottom: `1px solid ${data.color}44`,
        borderLeft: `1px solid ${data.color}44`,
        borderRadius: 5,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 10px',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 9,
            background: `${data.color}2a`,
            color: data.color,
            padding: '1px 4px',
            borderRadius: 3,
            fontFamily: 'monospace',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {LANG_BADGE[data.language] ?? '?'}
        </span>
        <span
          style={{
            fontSize: 10,
            color: '#d4d4d4',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.fileName}
        </span>
      </div>
      <span
        style={{
          fontSize: 8,
          color: `${data.color}aa`,
          fontFamily: 'monospace',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {data.sectionLabel}
      </span>
    </div>
  );
}

// ─── Outline strip: symbols extracted from file ──────────────────────────────

interface SymbolCategory {
  icon: string;
  color: string;
  items: string[];
}

function OutlineStrip({ symbols }: { symbols: FileSymbols }) {
  const cats: SymbolCategory[] = [
    { icon: 'ƒ', color: '#dcdcaa', items: symbols.functions.slice(0, 6) },
    { icon: 'T', color: '#4ec9b0', items: symbols.types.slice(0, 4) },
    { icon: '#', color: '#c084fc', items: symbols.defines.slice(0, 4) },
    { icon: '$', color: '#9cdcfe', items: symbols.globals.slice(0, 3) },
  ].filter((c) => c.items.length > 0);

  if (cats.length === 0) return null;

  return (
    <div
      style={{
        width: 58,
        background: '#1a1a1c',
        borderRight: '1px solid #2d2d2d',
        flexShrink: 0,
        padding: '4px 0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {cats.map((cat) => (
        <div key={cat.icon} style={{ marginBottom: 3 }}>
          <div
            style={{
              fontSize: 5.5,
              color: '#444',
              fontFamily: 'monospace',
              padding: '1px 4px',
              letterSpacing: '0.05em',
            }}
          >
            {cat.icon}
          </div>
          {cat.items.map((name) => (
            <div
              key={name}
              style={{
                fontSize: 5.5,
                color: cat.color,
                fontFamily: 'monospace',
                padding: '0.5px 4px 0.5px 7px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                opacity: 0.85,
              }}
            >
              {name}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// — LOD 3: Full VS Code–style card with real or skeleton code —
function NodeFull({
  data,
  selected,
  preview,
  entryGlow,
  symbols,
}: {
  data: FileNodeData;
  selected: boolean;
  preview: string | null;
  entryGlow: number; // 0-1
  symbols: FileSymbols | null;
}) {
  const skeletonLines = getSkeletonLines(data.filePath);
  const dir = data.filePath.split('/').slice(0, -1).join('/');
  const glowAlpha = Math.round(entryGlow * 180)
    .toString(16)
    .padStart(2, '0');
  const glowSize = 4 + entryGlow * 20;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1e1e1e',
        borderTop: `3px solid ${data.color}`,
        borderRight: `1px solid ${selected || entryGlow > 0 ? data.color : data.color + '44'}`,
        borderBottom: `1px solid ${selected || entryGlow > 0 ? data.color : data.color + '44'}`,
        borderLeft: `1px solid ${selected || entryGlow > 0 ? data.color : data.color + '44'}`,
        borderRadius: 5,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow:
          entryGlow > 0
            ? `0 0 ${glowSize}px ${data.color}${glowAlpha}, 0 0 ${glowSize * 2}px ${data.color}${Math.round(
                entryGlow * 80
              )
                .toString(16)
                .padStart(2, '0')}`
            : selected
              ? `0 0 0 1px ${data.color}66`
              : 'none',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          background: '#252526',
          borderBottom: '1px solid #3c3c3c',
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <div
          style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff5f57', flexShrink: 0 }}
        />
        <div
          style={{ width: 7, height: 7, borderRadius: '50%', background: '#ffbd2e', flexShrink: 0 }}
        />
        <div
          style={{ width: 7, height: 7, borderRadius: '50%', background: '#28c840', flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: 8,
            color: '#ffffff99',
            fontFamily: 'monospace',
            marginLeft: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.filePath}
        </span>
      </div>

      {/* Tab bar */}
      <div
        style={{
          background: '#2d2d2d',
          borderBottom: '1px solid #3c3c3c',
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          height: 20,
        }}
      >
        <div
          style={{
            background: '#1e1e1e',
            borderTop: `2px solid ${data.color}`,
            padding: '0 8px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 8, color: '#ffffffcc', fontFamily: 'monospace' }}>
            {data.fileName}
          </span>
        </div>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Outline / symbols strip */}
        {symbols ? (
          <OutlineStrip symbols={symbols} />
        ) : (
          /* Fallback: mini file tree skeleton */
          <div
            style={{
              width: 20,
              background: '#252526',
              borderRight: '1px solid #3c3c3c',
              flexShrink: 0,
              padding: '6px 4px',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            {[55, 38, 70, 28, 48].map((w, i) => (
              <div
                key={i}
                style={{
                  height: 2,
                  width: `${w}%`,
                  background: i === 2 ? data.color + '99' : '#484848',
                  borderRadius: 1,
                }}
              />
            ))}
          </div>
        )}

        {/* Code area */}
        <div style={{ flex: 1, display: 'flex', background: '#1e1e1e', overflow: 'hidden' }}>
          {/* Line numbers */}
          <div
            style={{
              width: 22,
              padding: '5px 2px 5px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: preview ? 2 : 3,
              alignItems: 'flex-end',
              flexShrink: 0,
              borderRight: '1px solid #2d2d2d',
            }}
          >
            {(preview ? preview.split('\n') : skeletonLines).map((_, i) => (
              <span
                key={i}
                style={{
                  fontSize: 6,
                  color: '#3a3a3a',
                  fontFamily: 'monospace',
                  lineHeight: preview ? '9px' : '10px',
                  paddingRight: 3,
                }}
              >
                {i + 1}
              </span>
            ))}
          </div>

          {/* Code content */}
          <div
            style={{
              flex: 1,
              padding: '5px 6px',
              overflow: 'hidden',
            }}
          >
            {preview ? (
              // Real code as plain text
              <pre
                style={{
                  margin: 0,
                  fontSize: 6,
                  lineHeight: '9px',
                  color: '#d4d4d4',
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                  overflow: 'hidden',
                  whiteSpace: 'pre',
                  tabSize: 2,
                }}
              >
                {preview}
              </pre>
            ) : (
              // Skeleton bars
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                {skeletonLines.map((line, i) => (
                  <div key={i} style={{ display: 'flex', paddingLeft: line.indent * 10 }}>
                    <div
                      style={{
                        height: 3,
                        width: `${line.width}%`,
                        background: line.color,
                        borderRadius: 1.5,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        style={{
          background: entryGlow > 0.5 ? `${data.color}dd` : data.color,
          padding: '2px 8px',
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'background 0.2s',
        }}
      >
        <span style={{ fontSize: 7, color: '#fff', fontFamily: 'monospace', fontWeight: 600 }}>
          {LANG_BADGE[data.language] ?? data.language.toUpperCase()}
          {entryGlow > 0.1 && (
            <span style={{ opacity: 0.85, marginLeft: 6 }}>
              {entryGlow >= 1
                ? '↵ entering...'
                : `↑ zoom to open (${Math.round(entryGlow * 100)}%)`}
            </span>
          )}
        </span>
        <span
          style={{
            fontSize: 7,
            color: '#ffffffcc',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {dir || data.sectionLabel}
        </span>
      </div>
    </div>
  );
}

function FileNodeInner({ data, selected }: NodeProps<FileNodeType>) {
  const { zoom } = useViewport();
  const { owner, repo, branch, selectedFilePath, symbolsMap } = useGraphContext();
  const isSelected = data.filePath === selectedFilePath;
  // Compute glow locally from zoom — avoids context churn on every scroll event
  const glow = isSelected
    ? Math.min(
        1,
        Math.max(0, (zoom - ENTRY_APPROACH_START) / (ENTRY_ZOOM_THRESHOLD - ENTRY_APPROACH_START))
      )
    : 0;
  const symbols = symbolsMap.get(data.filePath) ?? null;

  // Lazy-load real code preview when zoomed in enough
  const [preview, setPreview] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (zoom >= 1.0 && !fetchedRef.current && owner && repo && branch) {
      fetchedRef.current = true;
      fetchPreviewLines(owner, repo, branch, data.filePath).then((text) => {
        if (text) setPreview(text);
      });
    }
  }, [zoom, owner, repo, branch, data.filePath]);

  let inner: React.ReactNode;
  if (zoom < 0.28) {
    inner = <NodeTiny data={data} />;
  } else if (zoom < 0.72) {
    inner = <NodeCompact data={data} />;
  } else {
    inner = (
      <NodeFull
        data={data}
        selected={selected}
        preview={preview}
        entryGlow={glow}
        symbols={symbols}
      />
    );
  }

  return (
    <div style={{ width: 300, height: 180, cursor: 'pointer' }}>
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: 'none', width: 0, height: 0, border: 'none' }}
      />
      {inner}
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: 'none', width: 0, height: 0, border: 'none' }}
      />
    </div>
  );
}

export const FileNode = memo(FileNodeInner);

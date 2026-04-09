'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, useViewport } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { PairedNodeData } from '@/lib/graph-data';
import { useGraphContext } from '@/contexts/GraphContext';
import { ENTRY_ZOOM_THRESHOLD, ENTRY_APPROACH_START } from './ZoomWatcher';

export type PairedNodeType = Node<PairedNodeData, 'pairedNode'>;

async function fetchPreviewLines(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  maxLines = 28
): Promise<string | null> {
  try {
    const res = await fetch(`/repos/${owner}/${repo}/${branch}/${filePath}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.split('\n').slice(0, maxLines).join('\n');
  } catch {
    return null;
  }
}

// Shared module-level cache — same seed always yields same skeleton
const skeletonCache = new Map<string, Array<{ width: number; color: string; indent: number }>>();

function getSkeletonLines(seed: string): Array<{ width: number; color: string; indent: number }> {
  if (skeletonCache.has(seed)) return skeletonCache.get(seed)!;
  const hash = seed.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0);
  const abs = Math.abs(hash);
  const comment = '#6a9955',
    keyword = '#569cd6',
    def = '#d4d4d4',
    string = '#ce9178',
    number = '#b5cea8',
    type = '#4ec9b0';
  const lines = Array.from({ length: 14 }, (_, i) => {
    const s = Math.abs((abs + i * 37) % 100);
    let color = def,
      indent = 0;
    if (s < 8) color = comment;
    else if (s < 18) color = keyword;
    else if (s < 30) color = type;
    else if (s < 50) indent = 1;
    else if (s < 65) {
      indent = 2;
      color = string;
    } else if (s < 78) {
      indent = 1;
      color = number;
    } else indent = s % 3;
    return { width: 25 + Math.abs((abs + i * 19) % 55), color, indent };
  });
  skeletonCache.set(seed, lines);
  return lines;
}

// — LOD 1: tiny dot with a split stripe for .c / .h —
function PairedNodeTiny({ data }: { data: PairedNodeData }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        borderRadius: 6,
        overflow: 'hidden',
        border: `2px solid ${data.color}`,
      }}
    >
      <div style={{ flex: 1, background: `${data.color}1a` }} />
      <div style={{ width: 1, background: `${data.color}55` }} />
      <div style={{ flex: 1, background: `${data.color}0d` }} />
    </div>
  );
}

// — LOD 2: compact card with both filenames —
function PairedNodeCompact({ data }: { data: PairedNodeData }) {
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
        gap: 5,
      }}
    >
      {(
        [
          [data.primaryName, 'C'],
          [data.headerName, 'H'],
        ] as [string, string][]
      ).map(([name, badge]) => (
        <div key={badge} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
            {badge}
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
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}

// — LOD 3: VS Code card with two tabs (.c active, .h passive) —
function PairedNodeFull({
  data,
  isSelected,
  preview,
  entryGlow,
}: {
  data: PairedNodeData;
  isSelected: boolean;
  preview: string | null;
  entryGlow: number;
}) {
  const skeletonLines = useMemo(
    () => (preview ? null : getSkeletonLines(data.primaryPath)),
    [preview, data.primaryPath]
  );
  const glowAlpha = Math.round(entryGlow * 180)
    .toString(16)
    .padStart(2, '0');
  const glowSize = 4 + entryGlow * 20;
  const dir = data.primaryPath.split('/').slice(0, -1).join('/');

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1e1e1e',
        borderTop: `3px solid ${data.color}`,
        borderRight: `1px solid ${isSelected || entryGlow > 0 ? data.color : data.color + '44'}`,
        borderBottom: `1px solid ${isSelected || entryGlow > 0 ? data.color : data.color + '44'}`,
        borderLeft: `1px solid ${isSelected || entryGlow > 0 ? data.color : data.color + '44'}`,
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
            : isSelected
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
          {dir}
        </span>
      </div>

      {/* Tab bar — two tabs */}
      <div
        style={{
          background: '#2d2d2d',
          borderBottom: '1px solid #3c3c3c',
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          height: 20,
          gap: 1,
        }}
      >
        {/* .c tab — active */}
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
            {data.primaryName}
          </span>
        </div>
        {/* .h tab — inactive */}
        <div
          style={{
            background: 'transparent',
            borderTop: '2px solid transparent',
            padding: '0 8px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 8, color: '#ffffff55', fontFamily: 'monospace' }}>
            {data.headerName}
          </span>
        </div>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Mini sidebar */}
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
            {(preview ? preview.split('\n') : skeletonLines!).map((_, i) => (
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
          <div style={{ flex: 1, padding: '5px 6px', overflow: 'hidden' }}>
            {preview ? (
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {skeletonLines!.map((line, i) => (
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
          C⊞H
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
          {data.sectionLabel}
        </span>
      </div>
    </div>
  );
}

function PairedNodeInner({ data }: NodeProps<PairedNodeType>) {
  const { zoom } = useViewport();
  const { owner, repo, branch, selectedFilePath } = useGraphContext();

  const nodeId = `${data.primaryPath}|||${data.headerPath}`;
  const isSelected = nodeId === selectedFilePath;

  const glow = isSelected
    ? Math.min(
        1,
        Math.max(0, (zoom - ENTRY_APPROACH_START) / (ENTRY_ZOOM_THRESHOLD - ENTRY_APPROACH_START))
      )
    : 0;

  const [preview, setPreview] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (zoom >= 1.0 && !fetchedRef.current && owner && repo && branch) {
      fetchedRef.current = true;
      fetchPreviewLines(owner, repo, branch, data.primaryPath).then((text) => {
        if (text) setPreview(text);
      });
    }
  }, [zoom, owner, repo, branch, data.primaryPath]);

  let inner: React.ReactNode;
  if (zoom < 0.28) {
    inner = <PairedNodeTiny data={data} />;
  } else if (zoom < 0.72) {
    inner = <PairedNodeCompact data={data} />;
  } else {
    inner = (
      <PairedNodeFull data={data} isSelected={isSelected} preview={preview} entryGlow={glow} />
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

export const PairedNode = memo(PairedNodeInner);

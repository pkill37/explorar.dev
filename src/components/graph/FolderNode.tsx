'use client';

import { memo } from 'react';
import { Handle, Position, useViewport } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { FolderNodeData } from '@/lib/graph-data';

// These match the constants in graph-data.ts
const W = 200;
const H = 120;

export type FolderNodeType = Node<FolderNodeData, 'folderNode'>;

// LOD 1: Tiny dot (zoom < 0.10)
function FolderTiny({ color }: { color: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: `${color}1a`,
        border: `2px solid ${color}88`,
        borderRadius: 6,
      }}
    />
  );
}

// LOD 2: Compact label + file count (zoom 0.10–0.25)
function FolderCompact({ data }: { data: FolderNodeData }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1a1a1c',
        borderTop: `3px solid ${data.color}`,
        border: `1px solid ${data.color}44`,
        borderRadius: 5,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 10px',
        gap: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span
          style={{
            fontSize: 10,
            color: data.color,
            fontFamily: 'monospace',
            flexShrink: 0,
          }}
        >
          ▸
        </span>
        <span
          style={{
            fontSize: 10,
            color: '#d4d4d4',
            fontFamily: 'monospace',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.folderName}/
        </span>
      </div>
      <span
        style={{
          fontSize: 8,
          color: '#555',
          fontFamily: 'monospace',
        }}
      >
        {data.fileCount} files
      </span>
    </div>
  );
}

// LOD 3: Full folder card (zoom ≥ 0.25)
function FolderFull({ data, selected }: { data: FolderNodeData; selected: boolean }) {
  // Show up to 5 files; keep full path as key, display only basename
  const previewPaths = data.filePaths.slice(0, 5);
  const remaining = data.fileCount - previewPaths.length;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1a1a1c',
        borderTop: `3px solid ${data.color}`,
        border: `1px solid ${selected ? data.color : data.color + '44'}`,
        borderRadius: 5,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: selected ? `0 0 0 1px ${data.color}55` : 'none',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#252526',
          borderBottom: '1px solid #333',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, color: data.color, fontFamily: 'monospace' }}>▸</span>
        <span
          style={{
            fontSize: 9,
            color: '#d4d4d4',
            fontFamily: 'monospace',
            fontWeight: 600,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.folderName}/
        </span>
        <span
          style={{
            fontSize: 8,
            color: '#555',
            fontFamily: 'monospace',
            flexShrink: 0,
          }}
        >
          {data.fileCount}
        </span>
      </div>

      {/* File list */}
      <div
        style={{
          flex: 1,
          padding: '5px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflow: 'hidden',
        }}
      >
        {previewPaths.map((fullPath) => (
          <div
            key={fullPath}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <div
              style={{
                width: 4,
                height: 4,
                borderRadius: 1,
                background: data.color + '99',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 7,
                color: '#999',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {fullPath.split('/').pop() ?? fullPath}
            </span>
          </div>
        ))}
        {remaining > 0 && (
          <span
            style={{
              fontSize: 7,
              color: '#555',
              fontFamily: 'monospace',
            }}
          >
            +{remaining} more
          </span>
        )}
      </div>

      {/* Bottom bar */}
      <div
        style={{
          background: selected ? data.color : data.color + 'cc',
          padding: '2px 8px',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: 7, color: '#fff', fontFamily: 'monospace' }}>
          click to enter →
        </span>
      </div>
    </div>
  );
}

function FolderNodeInner({ data, selected }: NodeProps<FolderNodeType>) {
  const { zoom } = useViewport();

  let inner: React.ReactNode;
  if (zoom < 0.1) {
    inner = <FolderTiny color={data.color} />;
  } else if (zoom < 0.25) {
    inner = <FolderCompact data={data} />;
  } else {
    inner = <FolderFull data={data} selected={selected} />;
  }

  return (
    <div style={{ width: W, height: H, cursor: 'pointer' }}>
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

export const FolderNode = memo(FolderNodeInner);

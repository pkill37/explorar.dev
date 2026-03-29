'use client';

import { useReactFlow } from '@xyflow/react';

interface GraphControlsProps {
  selectedFilePath: string | null;
  onEnterEditor: () => void;
}

export function GraphControls({ selectedFilePath, onEnterEditor }: GraphControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      {selectedFilePath && (
        <button
          onClick={onEnterEditor}
          style={{
            background: '#0078d4',
            color: '#fff',
            border: 'none',
            borderRadius: 5,
            padding: '7px 14px',
            fontSize: 12,
            fontFamily: 'monospace',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 12px rgba(0,120,212,0.45)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.background = '#106ebe')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.background = '#0078d4')}
        >
          Open in Editor →
        </button>
      )}

      <div style={{ display: 'flex', gap: 4 }}>
        {(
          [
            { label: '+', title: 'Zoom in', action: () => zoomIn({ duration: 200 }) },
            { label: '−', title: 'Zoom out', action: () => zoomOut({ duration: 200 }) },
            {
              label: '⊡',
              title: 'Fit view',
              action: () => fitView({ padding: 0.12, duration: 400 }),
            },
          ] as const
        ).map(({ label, title, action }) => (
          <button
            key={label}
            onClick={action}
            title={title}
            style={{
              width: 30,
              height: 30,
              background: 'rgba(37,37,38,0.92)',
              color: '#ccc',
              border: '1px solid #3c3c3c',
              borderRadius: 5,
              cursor: 'pointer',
              fontSize: 14,
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) =>
              ((e.target as HTMLElement).style.background = 'rgba(60,60,60,0.95)')
            }
            onMouseLeave={(e) =>
              ((e.target as HTMLElement).style.background = 'rgba(37,37,38,0.92)')
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

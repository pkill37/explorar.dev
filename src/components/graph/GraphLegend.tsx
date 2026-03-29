'use client';

import {
  RELATIONSHIP_COLORS,
  RELATIONSHIP_LABELS,
  type RelationshipType,
} from '@/lib/code-analysis';

const EDGE_STYLES: Record<RelationshipType, { dash: string }> = {
  includes: { dash: 'none' },
  imports: { dash: 'none' },
  calls: { dash: '5 3' },
  defines: { dash: '2 3' },
};

const ENTRIES = (Object.keys(RELATIONSHIP_COLORS) as RelationshipType[]).map((type) => ({
  type,
  color: RELATIONSHIP_COLORS[type],
  label: RELATIONSHIP_LABELS[type],
  dash: EDGE_STYLES[type].dash,
}));

export function GraphLegend({ analysisLoading }: { analysisLoading: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: 24,
        zIndex: 10,
        background: 'rgba(20,20,22,0.88)',
        border: '1px solid #2a2a2a',
        borderRadius: 6,
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          fontSize: 9,
          color: '#555',
          fontFamily: 'monospace',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        relationships
        {analysisLoading && <span style={{ color: '#444', fontSize: 8 }}>· analysing…</span>}
      </span>
      {ENTRIES.map(({ type, color, label, dash }) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width={28} height={8} style={{ flexShrink: 0 }}>
            <line
              x1={0}
              y1={4}
              x2={28}
              y2={4}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray={dash === 'none' ? undefined : dash}
            />
          </svg>
          <span style={{ fontSize: 9, color: color, fontFamily: 'monospace' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

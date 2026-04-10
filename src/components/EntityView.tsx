'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getProjectConfig } from '@/lib/project-guides';
import { getGuideByRepo } from '@/lib/guides/docs-loader';
import { buildGraphData } from '@/lib/graph-data';
import {
  extractEntities,
  ENTITY_KIND_COLOR,
  type CodeEntity,
  type EntityKind,
} from '@/lib/entity-analysis';

// ─── Importance tiers ────────────────────────────────────────────────────────

type Tier = 'hero' | 'major' | 'minor';

interface ScoredEntity {
  entity: CodeEntity;
  refCount: number;
  score: number;
  tier: Tier;
}

function scoreEntities(entities: CodeEntity[]): ScoredEntity[] {
  // Deduplicate (same name+file)
  const seen = new Set<string>();
  const unique = entities.filter((e) => {
    const key = `${e.filePath}::${e.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Pre-compile one regex per entity name — reused across all field type strings
  const nameRegex = new Map<string, RegExp>(
    unique.map((e) => [e.name, new RegExp(`\\b${e.name}\\b`)])
  );

  // Count how many other entity fields reference each entity's name
  const refCounts = new Map<string, number>(unique.map((e) => [e.name, 0]));
  for (const e of unique) {
    for (const f of e.fields) {
      if (!f.type) continue;
      for (const candidate of unique) {
        if (candidate.name === e.name) continue;
        if (nameRegex.get(candidate.name)!.test(f.type)) {
          refCounts.set(candidate.name, (refCounts.get(candidate.name) ?? 0) + 1);
        }
      }
    }
  }

  const scores = unique.map((e) => {
    const refCount = refCounts.get(e.name) ?? 0;
    return { entity: e, refCount, score: e.fields.length + refCount * 3 };
  });

  const maxScore = Math.max(...scores.map((s) => s.score), 1);

  return scores
    .map((s) => ({
      ...s,
      tier: (s.score / maxScore >= 0.6
        ? 'hero'
        : s.score / maxScore >= 0.25
          ? 'major'
          : 'minor') as Tier,
    }))
    .sort((a, b) => b.score - a.score); // most important first
}

// ─── Entity card ─────────────────────────────────────────────────────────────

interface EntityCardProps {
  scored: ScoredEntity;
  onOpenFile: (path: string) => void;
}

function EntityCard({ scored, onOpenFile }: EntityCardProps) {
  const { entity, tier, refCount } = scored;
  const color = ENTITY_KIND_COLOR[entity.kind as EntityKind];

  const isHero = tier === 'hero';
  const isMajor = tier === 'major';

  const maxFields = isHero ? 16 : isMajor ? 10 : 6;
  const headerFontSize = isHero ? 14 : isMajor ? 12 : 10;
  const fieldFontSize = isHero ? 11 : isMajor ? 10 : 9;
  const footerFontSize = isHero ? 9 : 8;
  const headerPad = isHero ? '10px 12px' : isMajor ? '8px 10px' : '6px 8px';
  const fieldPad = isHero ? '0 12px' : isMajor ? '0 10px' : '0 8px';
  const fieldHeight = isHero ? 24 : isMajor ? 20 : 17;
  const borderTopWidth = isHero ? 4 : isMajor ? 3 : 2;

  const visibleFields = entity.fields.slice(0, maxFields);
  const hidden = entity.fields.length - visibleFields.length;

  return (
    <div
      onClick={() => onOpenFile(entity.filePath)}
      style={{
        fontFamily: 'monospace',
        background: '#1a1a1a',
        border: `1px solid ${color}33`,
        borderTop: `${borderTopWidth}px solid ${color}`,
        borderRadius: 7,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: isHero
          ? `0 0 20px ${color}20, 0 4px 20px rgba(0,0,0,0.5)`
          : isMajor
            ? `0 2px 10px rgba(0,0,0,0.4)`
            : `0 1px 5px rgba(0,0,0,0.3)`,
        opacity: tier === 'minor' ? 0.72 : 1,
        transition: 'opacity 0.15s, box-shadow 0.15s, border-color 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gridColumn: isHero ? 'span 2' : 'span 1',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.opacity = '1';
        el.style.borderColor = color;
        el.style.boxShadow = `0 0 18px ${color}50, 0 6px 24px rgba(0,0,0,0.6)`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.opacity = tier === 'minor' ? '0.72' : '1';
        el.style.border = `1px solid ${color}33`;
        el.style.borderTop = `${borderTopWidth}px solid ${color}`;
        el.style.boxShadow = isHero
          ? `0 0 20px ${color}20, 0 4px 20px rgba(0,0,0,0.5)`
          : isMajor
            ? `0 2px 10px rgba(0,0,0,0.4)`
            : `0 1px 5px rgba(0,0,0,0.3)`;
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: headerPad,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: `${color}${isHero ? '1e' : '10'}`,
          borderBottom: `1px solid ${color}22`,
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: headerFontSize,
            fontWeight: isHero ? 800 : 700,
            color: isHero ? '#f0f0f0' : isMajor ? '#ddd' : '#bbb',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {entity.name}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {refCount > 0 && (
            <span
              title={`Referenced by ${refCount} other ${refCount === 1 ? 'entity' : 'entities'}`}
              style={{
                fontSize: fieldFontSize - 1,
                color,
                background: `${color}20`,
                border: `1px solid ${color}44`,
                padding: '1px 5px',
                borderRadius: 10,
                fontWeight: 700,
                lineHeight: 1.4,
              }}
            >
              ×{refCount}
            </span>
          )}
          <span
            style={{
              fontSize: fieldFontSize - 1,
              color,
              background: `${color}18`,
              padding: '2px 5px',
              borderRadius: 3,
              fontWeight: 600,
            }}
          >
            {entity.kind}
          </span>
        </div>
      </div>

      {/* Fields */}
      <div style={{ flex: 1 }}>
        {visibleFields.map((field, idx) => (
          <div
            key={field.name}
            style={{
              height: fieldHeight,
              display: 'flex',
              alignItems: 'center',
              padding: fieldPad,
              background: idx % 2 === 0 ? '#1e1e1e' : '#191919',
              borderBottom: `1px solid #252525`,
            }}
          >
            <span
              style={{
                fontSize: fieldFontSize,
                color: '#9cdcfe',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: '0 0 40%',
              }}
            >
              {field.name}
            </span>
            {field.type && (
              <span
                style={{
                  fontSize: fieldFontSize,
                  color: '#4ec9b0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  marginLeft: 8,
                }}
              >
                {field.type}
              </span>
            )}
          </div>
        ))}
        {hidden > 0 && (
          <div
            style={{
              height: fieldHeight,
              display: 'flex',
              alignItems: 'center',
              padding: fieldPad,
              background: '#191919',
            }}
          >
            <span style={{ fontSize: fieldFontSize - 1, color: '#444' }}>+{hidden} more…</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: `4px ${isHero ? '12px' : isMajor ? '10px' : '8px'}`,
          background: '#141414',
          borderTop: `1px solid #232323`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: footerFontSize,
            color: '#3a3a3a',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          {entity.filePath}
        </span>
      </div>
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────

interface ChapterEntry {
  id: string;
  files: string[];
}

interface EntityViewProps {
  owner: string;
  repo: string;
  onOpenFile: (path: string) => void;
  activeChapterId?: string | null;
  chapterMapEntries?: ChapterEntry[];
}

const FETCH_CAP = 40;
const BATCH_SIZE = 8;
const BYTES_CAP = 60 * 1024;

export function EntityView({
  owner,
  repo,
  onOpenFile,
  activeChapterId,
  chapterMapEntries,
}: EntityViewProps) {
  const projectConfig = useMemo(() => getProjectConfig(owner, repo), [owner, repo]);
  const branch = projectConfig?.defaultBranch ?? 'main';

  // Per-key entity cache — key is chapterId or '__all__'
  const cacheRef = useRef<Map<string, ScoredEntity[]>>(new Map());

  const [scored, setScored] = useState<ScoredEntity[]>([]);
  const [loading, setLoading] = useState(false);

  // Stable key for the current view
  const currentKey = activeChapterId ?? '__all__';

  // Files to fetch for the current key
  const filesToFetch = useMemo(() => {
    if (chapterMapEntries && chapterMapEntries.length > 0) {
      if (activeChapterId) {
        return chapterMapEntries.find((e) => e.id === activeChapterId)?.files ?? [];
      }
      // All chapters merged, deduped
      const seen = new Set<string>();
      const all: string[] = [];
      for (const entry of chapterMapEntries) {
        for (const f of entry.files) {
          if (!seen.has(f)) {
            seen.add(f);
            all.push(f);
          }
        }
      }
      return all;
    }
    // Fallback: extract from guide content (no chapter map available)
    const guideDoc = getGuideByRepo(owner, repo);
    if (!guideDoc) return [] as string[];
    const { nodes } = buildGraphData(guideDoc.content);
    return nodes.map((n) => n.id);
  }, [owner, repo, activeChapterId, chapterMapEntries]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!branch || filesToFetch.length === 0) {
        setScored([]);
        setLoading(false);
        return;
      }

      // Cache hit — show immediately, no loading state
      const cached = cacheRef.current.get(currentKey);
      if (cached) {
        setScored(cached);
        setLoading(false);
        return;
      }

      setLoading(true);

      const allEntities: CodeEntity[] = [];
      const batch = filesToFetch.slice(0, FETCH_CAP);

      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        if (cancelled) return;
        await Promise.all(
          batch.slice(i, i + BATCH_SIZE).map(async (fp: string) => {
            try {
              const res = await fetch(`/repos/${owner}/${repo}/${branch}/${fp}`, {
                signal: AbortSignal.timeout(5000),
              });
              if (!res.ok) return;
              const fullText = await res.text();
              const text = fullText.length > BYTES_CAP ? fullText.slice(0, BYTES_CAP) : fullText;
              allEntities.push(...extractEntities(fp, text));
            } catch {
              // skip
            }
          })
        );
      }

      if (cancelled) return;

      const result = allEntities.length > 0 ? scoreEntities(allEntities) : [];
      cacheRef.current.set(currentKey, result);
      setScored(result);
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [currentKey, branch, owner, repo, filesToFetch]);

  if (loading) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          color: '#444',
          gap: 10,
          background: '#0d0d0d',
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: '2px solid #333',
            borderTopColor: '#555',
            borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: 11 }}>scanning entities…</span>
      </div>
    );
  }

  if (scored.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          fontSize: 13,
          color: '#444',
          background: '#0d0d0d',
        }}
      >
        No entities found.
      </div>
    );
  }

  const heroCount = scored.filter((s) => s.tier === 'hero').length;
  const majorCount = scored.filter((s) => s.tier === 'major').length;

  const chapterLabel =
    activeChapterId && chapterMapEntries
      ? (chapterMapEntries.find((e) => e.id === activeChapterId)?.id ?? null)
      : null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#0d0d0d',
        overflow: 'auto',
        position: 'relative',
      }}
    >
      {/* Stats bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '6px 16px',
          background: '#0d0d0d',
          borderBottom: '1px solid #1e1e1e',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontFamily: 'monospace',
          fontSize: 10,
        }}
      >
        {chapterLabel && (
          <span
            style={{
              color: '#0078d4',
              background: '#0078d420',
              border: '1px solid #0078d440',
              padding: '1px 7px',
              borderRadius: 3,
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            {chapterLabel}
          </span>
        )}
        <span style={{ color: '#555' }}>{scored.length} entities</span>
        {heroCount > 0 && (
          <span style={{ color: '#666' }}>
            <span style={{ color: '#888' }}>{heroCount}</span> core
          </span>
        )}
        {majorCount > 0 && (
          <span style={{ color: '#555' }}>
            <span style={{ color: '#666' }}>{majorCount}</span> major
          </span>
        )}
        <span style={{ color: '#333', marginLeft: 'auto', fontSize: 9 }}>
          ×N = referenced by N entities · click to open file
        </span>
      </div>

      {/* Grid */}
      <div
        style={{
          padding: 14,
          display: 'grid',
          // base column width ~220px; hero cards span 2 cols
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
          alignItems: 'start',
        }}
      >
        {scored.map((s, i) => (
          <EntityCard
            key={`${s.entity.filePath}::${s.entity.name}::${i}`}
            scored={s}
            onOpenFile={onOpenFile}
          />
        ))}
      </div>
    </div>
  );
}

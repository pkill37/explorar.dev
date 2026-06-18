'use client';

import { useMemo, useState } from 'react';
import type { NodeEvidenceSummary, OpenCodeIntelBundle } from '@/lib/open-code-intel';

interface CodeIntelPanelProps {
  bundle: OpenCodeIntelBundle | null;
  selectedNodeId: string | null;
  selectedPaths: string[];
  selectedEvidence: NodeEvidenceSummary;
  query: string;
  queryMatchCount: number;
  onQueryChange: (value: string) => void;
  onFocusQuery: () => void;
  onImportBundle: (raw: string) => void;
  onClearBundle: () => void;
}

function metricLabel(label: string, value: number) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
        fontSize: 11,
        color: '#a3a3a3',
      }}
    >
      <span>{label}</span>
      <span style={{ color: '#ddd' }}>{value}</span>
    </div>
  );
}

export function CodeIntelPanel({
  bundle,
  selectedNodeId,
  selectedPaths,
  selectedEvidence,
  query,
  queryMatchCount,
  onQueryChange,
  onFocusQuery,
  onImportBundle,
  onClearBundle,
}: CodeIntelPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState(false);

  const headerLabel = useMemo(() => {
    if (!bundle) return 'No external intelligence loaded';
    return `${bundle.format.toUpperCase()} bundle loaded`;
  }, [bundle]);

  const textareaValue = exportMode ? (bundle ? JSON.stringify(bundle, null, 2) : '') : rawInput;

  const handleImport = () => {
    try {
      onImportBundle(rawInput);
      setError(null);
      setExportMode(false);
      setRawInput('');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import failed');
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        width: isOpen ? 360 : 176,
        zIndex: 11,
        pointerEvents: 'auto',
        fontFamily: 'monospace',
        transition: 'width 0.18s ease',
      }}
    >
      <div
        style={{
          background: 'rgba(17,17,17,0.94)',
          border: '1px solid #303030',
          borderRadius: 8,
          boxShadow: '0 12px 34px rgba(0,0,0,0.38)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setIsOpen((current) => {
              const next = !current;
              if (!next) {
                setRawInput('');
                setError(null);
                setExportMode(false);
              }
              return next;
            });
          }}
          style={{
            width: '100%',
            border: 'none',
            background: 'transparent',
            color: '#ddd',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          <span
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
          >
            <span style={{ color: '#f1f1f1' }}>Code Intelligence</span>
            <span style={{ color: '#8b8b8b', fontSize: 10 }}>{headerLabel}</span>
          </span>
          <span style={{ color: '#7d7d7d' }}>{isOpen ? '−' : '+'}</span>
        </button>

        {isOpen && (
          <div
            style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div
              style={{
                border: '1px solid #252525',
                borderRadius: 6,
                padding: 10,
                background: '#141414',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 10, color: '#8d8d8d', textTransform: 'uppercase' }}>
                Open formats
              </div>
              <div style={{ fontSize: 11, color: '#c7c7c7', lineHeight: 1.5 }}>
                Import `LSP`, `SCIP`, `LSIF`, `SARIF`, or a simple custom JSON bundle.
              </div>
              {metricLabel('symbols', bundle?.symbols.length ?? 0)}
              {metricLabel('references', bundle?.references.length ?? 0)}
              {metricLabel('diagnostics', bundle?.diagnostics.length ?? 0)}
              {metricLabel('query matches', queryMatchCount)}
            </div>

            <div
              style={{
                border: '1px solid #252525',
                borderRadius: 6,
                padding: 10,
                background: '#141414',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 10, color: '#8d8d8d', textTransform: 'uppercase' }}>
                Question To Graph
              </div>
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="auth handler, symbol, warning..."
                style={{
                  width: '100%',
                  border: '1px solid #343434',
                  borderRadius: 4,
                  background: '#0f0f0f',
                  color: '#ddd',
                  padding: '7px 8px',
                  fontSize: 11,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={onFocusQuery}
                style={{
                  border: '1px solid #3d3d3d',
                  borderRadius: 4,
                  background: '#1e1e1e',
                  color: '#e1e1e1',
                  padding: '7px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Focus matching nodes
              </button>
            </div>

            <div
              style={{
                border: '1px solid #252525',
                borderRadius: 6,
                padding: 10,
                background: '#141414',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 10, color: '#8d8d8d', textTransform: 'uppercase' }}>
                  Import / Export
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setExportMode(false);
                      setError(null);
                    }}
                    style={{
                      border: 'none',
                      background: exportMode ? 'transparent' : '#2f2f2f',
                      color: exportMode ? '#7d7d7d' : '#fff',
                      borderRadius: 4,
                      padding: '4px 6px',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    import
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportMode(true);
                      setError(null);
                    }}
                    style={{
                      border: 'none',
                      background: exportMode ? '#2f2f2f' : 'transparent',
                      color: exportMode ? '#fff' : '#7d7d7d',
                      borderRadius: 4,
                      padding: '4px 6px',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    export
                  </button>
                </div>
              </div>
              <textarea
                value={textareaValue}
                onChange={(event) => setRawInput(event.target.value)}
                placeholder={
                  exportMode
                    ? 'Current normalized bundle will appear here.'
                    : 'Paste JSON from an LSP dump, SCIP index, LSIF graph, SARIF run, or custom bundle.'
                }
                readOnly={exportMode}
                spellCheck={false}
                style={{
                  width: '100%',
                  minHeight: 120,
                  resize: 'vertical',
                  border: '1px solid #343434',
                  borderRadius: 4,
                  background: '#0f0f0f',
                  color: '#d7d7d7',
                  padding: 8,
                  fontSize: 10,
                  lineHeight: 1.45,
                  outline: 'none',
                }}
              />
              {error && <div style={{ color: '#f87171', fontSize: 10 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                {!exportMode && (
                  <button
                    type="button"
                    onClick={handleImport}
                    style={{
                      flex: 1,
                      border: '1px solid #3d3d3d',
                      borderRadius: 4,
                      background: '#1e1e1e',
                      color: '#e1e1e1',
                      padding: '7px 10px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Import bundle
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClearBundle}
                  style={{
                    flex: 1,
                    border: '1px solid #3d3d3d',
                    borderRadius: 4,
                    background: 'transparent',
                    color: '#a7a7a7',
                    padding: '7px 10px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Clear stored bundle
                </button>
              </div>
            </div>

            <div
              style={{
                border: '1px solid #252525',
                borderRadius: 6,
                padding: 10,
                background: '#141414',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 10, color: '#8d8d8d', textTransform: 'uppercase' }}>
                Unified Evidence
              </div>
              <div style={{ fontSize: 11, color: '#e0e0e0' }}>
                {selectedNodeId ? selectedNodeId : 'Select a node to inspect evidence.'}
              </div>
              {selectedPaths.length > 0 && (
                <div style={{ fontSize: 10, color: '#7d7d7d', lineHeight: 1.5 }}>
                  {selectedPaths.slice(0, 4).join(' · ')}
                  {selectedPaths.length > 4 ? ` · +${selectedPaths.length - 4} more` : ''}
                </div>
              )}
              {metricLabel('symbols', selectedEvidence.symbols.length)}
              {metricLabel('diagnostics', selectedEvidence.diagnostics.length)}
              {metricLabel('references', selectedEvidence.references.length)}
              {metricLabel('graph edges', selectedEvidence.graphEdges.length)}
              {(selectedEvidence.symbols[0] ||
                selectedEvidence.diagnostics[0] ||
                selectedEvidence.references[0]) && (
                <div
                  style={{
                    borderTop: '1px solid #242424',
                    paddingTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 10,
                    color: '#bfbfbf',
                    lineHeight: 1.45,
                  }}
                >
                  {selectedEvidence.symbols.slice(0, 3).map((symbol) => (
                    <div key={`${symbol.filePath}:${symbol.name}:${symbol.line ?? 0}`}>
                      <span style={{ color: '#fbbf24' }}>{symbol.provenance}</span>{' '}
                      <span style={{ color: '#e5e5e5' }}>{symbol.name}</span>{' '}
                      <span style={{ color: '#767676' }}>{symbol.kind}</span>
                    </div>
                  ))}
                  {selectedEvidence.diagnostics.slice(0, 2).map((diagnostic) => (
                    <div key={`${diagnostic.filePath}:${diagnostic.message}`}>
                      <span style={{ color: '#f87171' }}>{diagnostic.severity}</span>{' '}
                      <span>{diagnostic.message}</span>
                    </div>
                  ))}
                  {selectedEvidence.references.slice(0, 2).map((reference) => (
                    <div
                      key={`${reference.fromFilePath}:${reference.toFilePath}:${reference.label}`}
                    >
                      <span style={{ color: '#60a5fa' }}>{reference.provenance}</span>{' '}
                      <span>{reference.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

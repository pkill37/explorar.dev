'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { type CuratedRepoSourceMode } from '@/lib/curated-content-url';
import { fetchManualPageHtml, getManPageLabel, type ManPageEntry } from '@/lib/man-pages';

interface ManualPagePreviewProps {
  name: string;
  section: string;
  sourceMode: CuratedRepoSourceMode;
}

type ManualPageState = {
  requestKey: string;
  html: string;
  entry: ManPageEntry | null;
  error: string | null;
};

function extractBodyHtml(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (bodyMatch?.[1] ?? html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '');
}

const ManualPagePreview: React.FC<ManualPagePreviewProps> = ({ name, section, sourceMode }) => {
  const label = getManPageLabel(name, section);
  const requestKey = `${sourceMode}:${label}`;
  const [state, setState] = useState<ManualPageState>(() => ({
    requestKey,
    html: '',
    entry: null,
    error: null,
  }));
  const visibleState =
    state.requestKey === requestKey
      ? state
      : {
          requestKey,
          html: '',
          entry: null,
          error: null,
        };
  const isLoading = visibleState.html === '' && visibleState.error === null;

  useEffect(() => {
    let cancelled = false;

    fetchManualPageHtml(name, section, { sourceMode })
      .then((result) => {
        if (cancelled) return;
        setState({
          requestKey,
          html: result.html,
          entry: result.entry,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          requestKey,
          html: '',
          entry: null,
          error: err instanceof Error ? err.message : 'Failed to load manual page',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [name, section, sourceMode, requestKey]);

  const bodyHtml = useMemo(() => extractBodyHtml(visibleState.html), [visibleState.html]);

  if (isLoading) {
    return (
      <div className="vscode-editor">
        <div className="vscode-loading">
          <div className="vscode-spinner" />
          <div>Loading manual page...</div>
        </div>
      </div>
    );
  }

  if (visibleState.error) {
    return (
      <div className="vscode-editor">
        <div className="vscode-loading">
          <div>Failed to load manual page</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>{visibleState.error}</div>
          <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>Page: {label}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="vscode-editor" style={{ overflow: 'auto' }}>
      <div className="manual-page-preview">
        <div className="manual-page-kicker">
          Linux man-pages {visibleState.entry?.section ?? section}
        </div>
        <h1>{visibleState.entry?.title || label}</h1>
        <article dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </div>
    </div>
  );
};

export default ManualPagePreview;

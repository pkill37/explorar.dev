'use client';

import { useEffect, useState } from 'react';
import mermaid from 'mermaid';

if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: { darkMode: true },
  });
}

interface MermaidDiagramProps {
  chart: string;
  id: string;
}

export default function MermaidDiagram({ chart, id }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const uid = `mermaid-${id}-${Date.now()}`;
    let cancelled = false;
    mermaid
      .render(uid, chart)
      .then(({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to render');
      });
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div
        style={{
          padding: 12,
          background: 'rgba(200,50,50,0.1)',
          border: '1px solid rgba(200,50,50,0.3)',
          borderRadius: 4,
          color: '#f87171',
          fontSize: 11,
          fontFamily: 'monospace',
        }}
      >
        diagram error: {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        suppressHydrationWarning
        style={{ padding: 12, color: '#444', fontFamily: 'monospace', fontSize: 11 }}
      >
        rendering…
      </div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}

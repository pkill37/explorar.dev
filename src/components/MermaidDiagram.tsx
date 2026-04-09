'use client';

import { useEffect, useRef, useState } from 'react';

// Cache rendered SVGs by chart content to avoid re-rendering identical diagrams
const svgCache = new Map<string, string>();

// Singleton mermaid init — only loads the library once, on first intersection
let mermaidInitialized = false;
let mermaidInitPromise: Promise<(typeof import('mermaid'))['default']> | null = null;

function getMermaid() {
  if (!mermaidInitPromise) {
    mermaidInitPromise = import('mermaid').then((m) => {
      if (!mermaidInitialized) {
        m.default.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: { darkMode: true },
        });
        mermaidInitialized = true;
      }
      return m.default;
    });
  }
  return mermaidInitPromise;
}

// Serialize renders so multiple diagrams scrolling into view simultaneously
// don't all call mermaid.render() at once and fight over the main thread.
let renderQueue = Promise.resolve();
function queueRender(fn: () => Promise<void>): void {
  renderQueue = renderQueue.then(fn).catch(() => {});
}

interface MermaidDiagramProps {
  chart: string;
  id: string;
}

export default function MermaidDiagram({ chart, id }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>(() => svgCache.get(chart) ?? '');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    // Already rendered (e.g. from cache hydration)
    if (rendered.current || svg) {
      rendered.current = true;
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || rendered.current) return;
        rendered.current = true;
        observer.disconnect();

        // Check cache again (another instance may have rendered while waiting)
        const cached = svgCache.get(chart);
        if (cached) {
          if (!cancelled) setSvg(cached);
          return;
        }

        const uid = `mermaid-${id}-${Date.now()}`;
        queueRender(async () => {
          if (cancelled) return;
          try {
            const mermaid = await getMermaid();
            const { svg: rendered } = await mermaid.render(uid, chart);
            if (!cancelled) {
              svgCache.set(chart, rendered);
              setSvg(rendered);
            }
          } catch (err) {
            if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to render');
          }
        });
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [chart, id, svg]);

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
        ref={containerRef}
        suppressHydrationWarning
        style={{ padding: 12, color: '#444', fontFamily: 'monospace', fontSize: 11, minHeight: 40 }}
      />
    );
  }

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} />;
}

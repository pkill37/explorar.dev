'use client';

import React, { useMemo } from 'react';
import { marked } from 'marked';
import {
  escapeHtml,
  getRepoLinkAttributes,
  hasUnsafeScheme,
  isExternalHref,
  parseRepoNavigationTarget,
  resolveRepoRelativePath,
} from '@/lib/markdown-navigation';

interface MarkdownPreviewProps {
  content: string;
  filePath: string;
  isLoading: boolean;
  onOpenFile?: (path: string, searchPattern?: string, scrollToLine?: number) => void;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  filePath,
  isLoading,
  onOpenFile,
}) => {
  const html = useMemo(() => {
    const renderer = new marked.Renderer();

    renderer.html = (html) => escapeHtml(html);

    renderer.link = (href, title, text) => {
      const safeHref = href?.trim() || '#';
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';

      if (hasUnsafeScheme(safeHref)) {
        return `<span>${text}</span>`;
      }

      if (safeHref.startsWith('#')) {
        return `<a href="${escapeHtml(safeHref)}"${titleAttr}>${text}</a>`;
      }

      const repoTarget = parseRepoNavigationTarget(safeHref, filePath);
      if (repoTarget) {
        return `<a href="#" ${getRepoLinkAttributes(repoTarget)}${titleAttr}>${text}</a>`;
      }

      const targetAttr = isExternalHref(safeHref) ? ' target="_blank" rel="noreferrer"' : '';
      return `<a href="${escapeHtml(safeHref)}"${titleAttr}${targetAttr}>${text}</a>`;
    };

    renderer.codespan = (code) => {
      const repoTarget = parseRepoNavigationTarget(code, filePath);
      const codeHtml = `<code>${escapeHtml(code)}</code>`;
      if (!repoTarget) {
        return codeHtml;
      }

      return `<a href="#" class="inline-code-link" ${getRepoLinkAttributes(repoTarget)}>${codeHtml}</a>`;
    };

    renderer.image = (href, title, text) => {
      const safeHref = href?.trim() || '';
      if (!safeHref || hasUnsafeScheme(safeHref)) {
        return '';
      }

      const repoPath = resolveRepoRelativePath(filePath, safeHref);
      const src = repoPath ? '#' : escapeHtml(safeHref);
      const repoAttr = repoPath ? ` data-repo-path="${escapeHtml(repoPath)}"` : '';
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      const altAttr = escapeHtml(text || '');
      return `<img src="${src}" alt="${altAttr}"${titleAttr}${repoAttr} />`;
    };

    marked.setOptions({
      gfm: true,
      breaks: true,
      renderer,
    });

    return marked.parse(content) as string;
  }, [content, filePath]);

  if (isLoading) {
    return (
      <div className="vscode-editor">
        <div className="vscode-loading">
          <div className="vscode-spinner" />
          <div>Loading markdown preview...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="vscode-editor" style={{ overflow: 'auto' }}>
      <div
        style={{
          maxWidth: '920px',
          margin: '0 auto',
          padding: '32px 40px 48px',
          color: 'var(--vscode-editor-foreground, #d4d4d4)',
          lineHeight: 1.7,
          fontSize: '15px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--vscode-text-muted, #999)',
            marginBottom: '20px',
          }}
        >
          Markdown Preview
        </div>
        <article
          data-markdown-preview={filePath}
          dangerouslySetInnerHTML={{ __html: html }}
          onClick={(event) => {
            const target = event.target as HTMLElement;
            const anchor = target.closest('a[data-repo-path], img[data-repo-path]');
            if (!anchor || !onOpenFile) {
              return;
            }

            const repoPath = anchor.getAttribute('data-repo-path');
            if (!repoPath) {
              return;
            }

            const searchPattern = anchor.getAttribute('data-search-pattern') || undefined;
            const scrollToLineAttr = anchor.getAttribute('data-scroll-to-line');
            const scrollToLine = scrollToLineAttr ? parseInt(scrollToLineAttr, 10) : undefined;

            event.preventDefault();
            onOpenFile(repoPath, searchPattern, scrollToLine);
          }}
          style={{
            wordBreak: 'break-word',
          }}
        />
      </div>
    </div>
  );
};

export default MarkdownPreview;

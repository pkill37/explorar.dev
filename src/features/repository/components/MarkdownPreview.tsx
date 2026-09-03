'use client';

import React, { useMemo } from 'react';
import { marked } from 'marked';
import {
  decodeHtmlEntities,
  escapeHtml,
  getManualPageLinkAttributes,
  getRepoLinkAttributes,
  hasUnsafeScheme,
  isExternalHref,
  parseMarkdownNavigationTarget,
  parseRepoNavigationTarget,
  resolveRepoRelativePath,
} from '@/lib/markdown-navigation';

interface MarkdownPreviewProps {
  content: string;
  filePath: string;
  isLoading: boolean;
  onOpenFile?: (
    path: string,
    searchPattern?: string,
    scrollToLine?: number,
    searchScope?: string[],
    repoTarget?: { owner: string; repo: string }
  ) => void;
  onOpenManPage?: (name: string, section: string) => void;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  filePath,
  isLoading,
  onOpenFile,
  onOpenManPage,
}) => {
  const html = useMemo(() => {
    const renderer = new marked.Renderer();

    renderer.html = (html) => escapeHtml(html);

    renderer.link = (href, title, text) => {
      const safeHref = href?.trim() || '#';
      // Avoid invalid nested anchors for markdown links around inline-code
      // navigation links (for example, [`symbol`](path:symbol)).
      const linkText = text.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';

      if (hasUnsafeScheme(safeHref)) {
        return `<span>${text}</span>`;
      }

      if (safeHref.startsWith('#')) {
        return `<a href="${escapeHtml(safeHref)}"${titleAttr}>${linkText}</a>`;
      }

      const navigationTarget = parseMarkdownNavigationTarget(safeHref, filePath, {
        linkText,
        title: title ?? undefined,
      });
      if (navigationTarget?.kind === 'man-page') {
        return `<a href="#" ${getManualPageLinkAttributes(navigationTarget)}${titleAttr}>${linkText}</a>`;
      }
      if (navigationTarget?.kind === 'repo-file') {
        return `<a href="#" ${getRepoLinkAttributes(navigationTarget)}${titleAttr}>${linkText}</a>`;
      }

      const targetAttr = isExternalHref(safeHref) ? ' target="_blank" rel="noreferrer"' : '';
      return `<a href="${escapeHtml(safeHref)}"${titleAttr}${targetAttr}>${linkText}</a>`;
    };

    renderer.codespan = (code) => {
      const decodedCode = decodeHtmlEntities(code);
      const navigationTarget = parseMarkdownNavigationTarget(decodedCode, filePath);
      if (navigationTarget?.kind === 'man-page') {
        return `<a href="#" class="inline-code-link" ${getManualPageLinkAttributes(navigationTarget)}><code>${escapeHtml(decodedCode)}</code></a>`;
      }

      const repoTarget = parseRepoNavigationTarget(decodedCode, filePath);
      const codeHtml = `<code>${escapeHtml(decodedCode)}</code>`;
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
            const anchor = target.closest(
              'a[data-repo-path], img[data-repo-path], a[data-man-page-name]'
            );
            if (!anchor) {
              return;
            }

            const manPageName = anchor.getAttribute('data-man-page-name');
            const manPageSection = anchor.getAttribute('data-man-page-section');
            if (manPageName && manPageSection && onOpenManPage) {
              event.preventDefault();
              onOpenManPage(manPageName, manPageSection);
              return;
            }

            const repoPath = anchor.getAttribute('data-repo-path');
            if (!repoPath || !onOpenFile) {
              return;
            }

            const searchPattern = anchor.getAttribute('data-search-pattern') || undefined;
            const scrollToLineAttr = anchor.getAttribute('data-scroll-to-line');
            const scrollToLine = scrollToLineAttr ? parseInt(scrollToLineAttr, 10) : undefined;
            const repoOwner = anchor.getAttribute('data-repo-owner') || undefined;
            const repoName = anchor.getAttribute('data-repo-name') || undefined;

            event.preventDefault();
            onOpenFile(
              repoPath,
              searchPattern,
              scrollToLine,
              undefined,
              repoOwner && repoName ? { owner: repoOwner, repo: repoName } : undefined
            );
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

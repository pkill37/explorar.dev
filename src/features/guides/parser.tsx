// Markdown parser utility for guide files
import React from 'react';
import matter from 'gray-matter';
import { marked } from 'marked';
import { GuideSection, FileRecommendation } from '@/lib/project-guides';
import { QuizQuestion } from '@/components/ChapterQuiz';
import ChapterQuiz from '@/components/ChapterQuiz';
import { createFileRecommendationsComponent } from '@/lib/project-guides';
import MermaidDiagram from '@/components/MermaidDiagram';
import { debugLog } from '@/lib/browser-debug';
import {
  escapeHtml,
  getRepoLinkAttributes,
  parseRepoNavigationTarget,
} from '@/lib/markdown-navigation';

/** Extract and strip a ```chapter-graph block from section content. */
function extractChapterGraph(content: string): { graph: string | undefined; cleanContent: string } {
  const re = /```chapter-graph\n([\s\S]*?)```/;
  const match = content.match(re);
  if (!match) return { graph: undefined, cleanContent: content };
  return {
    graph: match[1].trim(),
    cleanContent: content.replace(re, '').trim(),
  };
}

function isLikelySymbolCode(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed || trimmed.length > 120) return false;
  if (/[\s/\\]/.test(trimmed)) return false;
  if (/^(true|false|null|undefined|\d+)$/i.test(trimmed)) return false;
  return /^(?:[A-Za-z_]\w*|[A-Za-z_]\w*::[A-Za-z_]\w*)(?:\(\))?$/.test(trimmed);
}

// Custom renderer for marked to handle mermaid blocks
function createMarkdownRenderer(sectionId: string, symbolScopePaths: string[]) {
  const renderer = new marked.Renderer();
  let mermaidCounter = 0;

  renderer.code = function (code, language) {
    if (language === 'mermaid') {
      const diagramId = `${sectionId}-mermaid-${mermaidCounter++}`;
      // Return a placeholder that we'll replace with React component
      return `<div class="mermaid-placeholder" data-chart="${encodeURIComponent(code)}" data-id="${diagramId}"></div>`;
    }
    // Default code block rendering
    return `<pre><code class="language-${language || ''}">${code}</code></pre>`;
  };

  renderer.codespan = function (code) {
    const repoTarget = parseRepoNavigationTarget(code);
    const codeHtml = `<code>${escapeHtml(code)}</code>`;

    if (!repoTarget) {
      if (symbolScopePaths.length > 0 && isLikelySymbolCode(code)) {
        return `<a href="#" class="inline-code-link" data-search-pattern="${escapeHtml(
          code.trim()
        )}" data-symbol-scope="${escapeHtml(symbolScopePaths.join('|||'))}">${codeHtml}</a>`;
      }
      return codeHtml;
    }

    return `<a href="#" class="inline-code-link" ${getRepoLinkAttributes(repoTarget)}>${codeHtml}</a>`;
  };

  return renderer;
}

// Convert HTML with mermaid placeholders to React elements.
// Uses regex string splitting (no DOM API) so output is identical on server and client.
function htmlToReact(html: string, sectionId: string): React.ReactNode {
  const placeholderRe =
    /<div class="mermaid-placeholder" data-chart="([^"]*)" data-id="([^"]*)"><\/div>/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = placeholderRe.exec(html)) !== null) {
    const before = html.slice(lastIndex, match.index);
    if (before) {
      parts.push(<div key={`html-${index}`} dangerouslySetInnerHTML={{ __html: before }} />);
    }
    const chart = decodeURIComponent(match[1]);
    const id = match[2] || `${sectionId}-${index}`;
    parts.push(<MermaidDiagram key={`mermaid-${index}`} chart={chart} id={id} />);
    lastIndex = match.index + match[0].length;
    index++;
  }

  if (parts.length === 0) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const remaining = html.slice(lastIndex);
  if (remaining) {
    parts.push(<div key="html-final" dangerouslySetInnerHTML={{ __html: remaining }} />);
  }

  return <>{parts}</>;
}

// Parse section frontmatter
interface SectionFrontmatter {
  id: string;
  title: string;
  fileRecommendations?: {
    readingOrder?: FileRecommendation[];
    docs?: FileRecommendation[];
    source?: FileRecommendation[];
    directories?: FileRecommendation[];
  };
  quiz?: QuizQuestion[];
}

function pushUniquePath(target: string[], seen: Set<string>, path: string) {
  if (!path || seen.has(path)) return;
  seen.add(path);
  target.push(path);
}

function extractNarrativePaths(sectionContent: string, sectionMeta: SectionFrontmatter): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  const readingOrder = sectionMeta.fileRecommendations?.readingOrder ?? [];
  const fallbackRecommendations =
    readingOrder.length > 0
      ? readingOrder
      : [
          ...(sectionMeta.fileRecommendations?.docs ?? []),
          ...(sectionMeta.fileRecommendations?.source ?? []),
        ];

  for (const recommendation of fallbackRecommendations) {
    const target = parseRepoNavigationTarget(recommendation.path);
    if (!target) continue;
    pushUniquePath(paths, seen, target.path);
  }

  const markdownLinkRe = /\[[^\]]+\]\(([^)\s]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = markdownLinkRe.exec(sectionContent)) !== null) {
    const target = parseRepoNavigationTarget(match[1]);
    if (!target) continue;
    pushUniquePath(paths, seen, target.path);
  }

  const codeSpanRe = /`([^`\n]+)`/g;
  while ((match = codeSpanRe.exec(sectionContent)) !== null) {
    const target = parseRepoNavigationTarget(match[1]);
    if (!target) continue;
    pushUniquePath(paths, seen, target.path);
  }

  return paths;
}

function looksLikeSectionFrontmatter(frontmatter: string): boolean {
  if (!frontmatter.trim()) return false;

  const lines = frontmatter
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.some(
    (line) =>
      line.startsWith('id:') ||
      line.startsWith('title:') ||
      line.startsWith('fileRecommendations:') ||
      line.startsWith('quiz:')
  );
}

// Split markdown into sections by "---" delimiters with frontmatter
function splitIntoSections(content: string): Array<{ frontmatter: string; content: string }> {
  const sections: Array<{ frontmatter: string; content: string }> = [];

  // Split by section delimiters (--- on its own line)
  // Pattern: ---\n (optional blank lines) frontmatter \n---\n (optional blank lines) content
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    // Find the start of a section (--- on its own line)
    if (lines[i].trim() === '---') {
      i++; // Skip the --- line

      // Skip blank lines after the first ---
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }

      // Collect frontmatter until we hit the closing ---
      const frontmatterLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '---') {
        frontmatterLines.push(lines[i]);
        i++;
      }

      // Skip the closing --- line
      if (i < lines.length && lines[i].trim() === '---') {
        i++;
      }

      // Skip blank lines after the closing ---
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }

      // Collect content until we hit the next section start or end of file
      const contentLines: string[] = [];
      while (i < lines.length) {
        // Check if this is the start of the next section
        if (lines[i].trim() === '---') {
          break; // Stop here, this is the next section
        }
        contentLines.push(lines[i]);
        i++;
      }

      const frontmatter = frontmatterLines.join('\n').trim();
      const sectionContent = contentLines.join('\n').trim();

      // Only treat this block as section metadata if it actually looks like
      // section frontmatter. Plain thematic breaks should be ignored.
      if (looksLikeSectionFrontmatter(frontmatter)) {
        sections.push({
          frontmatter,
          content: sectionContent,
        });
      }
    } else {
      i++;
    }
  }

  return sections;
}

// Parse section frontmatter using gray-matter (js-yaml) for correct nested YAML support
function parseSectionFrontmatter(yaml: string): SectionFrontmatter {
  try {
    return matter('---\n' + yaml + '\n---\n').data as SectionFrontmatter;
  } catch {
    return { id: '', title: '' };
  }
}

/**
 * Parse guide markdown file and return GuideSection array
 */
export function parseGuideMarkdown(
  markdown: string,
  openFileInTab: (
    path: string,
    searchPattern?: string,
    scrollToLine?: number,
    searchScope?: string[]
  ) => void
): GuideSection[] {
  // Validate inputs
  if (!markdown || markdown.trim().length === 0) {
    throw new Error('Empty markdown content provided');
  }

  if (typeof openFileInTab !== 'function') {
    throw new Error('openFileInTab callback is required and must be a function');
  }

  // Extract document-level frontmatter
  const { content: mainContent } = matter(markdown);

  // Split content into sections
  const sections = splitIntoSections(mainContent);

  const guideSections: GuideSection[] = sections
    .map((section, index): GuideSection | null => {
      // Parse section frontmatter
      const sectionMeta = parseSectionFrontmatter(section.frontmatter);

      // If id/title are missing, the "frontmatter" is likely markdown content
      // (e.g., when --- is used as a horizontal rule, not a YAML delimiter).
      // Auto-generate id/title from the first ## heading found.
      let sectionContent = section.content;
      if (!sectionMeta.id || !sectionMeta.title) {
        // Combine frontmatter and content since frontmatter is actually markdown
        const fullContent = section.frontmatter + '\n\n' + section.content;
        const headingMatch = fullContent.match(/^##\s+(.+)/m);
        if (headingMatch) {
          const headingText = headingMatch[1].trim();
          sectionMeta.title = headingText;
          sectionMeta.id =
            sectionMeta.id ||
            headingText
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');
          sectionContent = fullContent;
        } else {
          console.warn(
            `Section at index ${index} is missing required fields (id or title) and no ## heading found.`
          );
          return null;
        }
      }

      // Extract chapter-graph block (strip it from rendered content)
      const { graph, cleanContent: contentWithoutGraph } = extractChapterGraph(sectionContent);
      sectionContent = contentWithoutGraph;
      const narrativePaths = extractNarrativePaths(sectionContent, sectionMeta);

      // Convert markdown to HTML (only if content exists)
      let reactContent: React.ReactNode = null;
      if (sectionContent && sectionContent.trim().length > 0) {
        const renderer = createMarkdownRenderer(
          sectionMeta.id || `section-${index}`,
          narrativePaths.filter((path) => !path.endsWith('/'))
        );
        marked.setOptions({ renderer });
        // marked can return string or Promise<string>, but with sync renderer it's always string
        const htmlContent = marked(sectionContent) as string;

        // Convert HTML to React (handling mermaid diagrams)
        reactContent = htmlToReact(htmlContent, sectionMeta.id || `section-${index}`);
      }

      // Build section body with content, file recommendations, and quiz
      const body: React.ReactNode = (
        <div>
          <div
            data-guide-markdown={sectionMeta.id || `section-${index}`}
            onClick={(e: React.MouseEvent) => {
              const anchor = (e.target as HTMLElement).closest('a');
              if (!anchor) return;
              const href = anchor.getAttribute('href');
              const repoPath = anchor.getAttribute('data-repo-path');
              const searchPattern = anchor.getAttribute('data-search-pattern') || undefined;
              const scrollToLineAttr = anchor.getAttribute('data-scroll-to-line');
              const scrollToLine = scrollToLineAttr ? parseInt(scrollToLineAttr, 10) : undefined;
              const symbolScopeAttr = anchor.getAttribute('data-symbol-scope') || '';
              const symbolScope = symbolScopeAttr
                ? symbolScopeAttr.split('|||').filter(Boolean)
                : undefined;

              if (repoPath) {
                e.preventDefault();
                debugLog('[explorar:guide-link] repo-target', {
                  sectionId: sectionMeta.id,
                  repoPath,
                  searchPattern,
                  scrollToLine,
                  symbolScope,
                  href,
                });
                openFileInTab(repoPath, searchPattern, scrollToLine, symbolScope);
                return;
              }

              if (!href || href.startsWith('http://') || href.startsWith('https://')) {
                return;
              }

              e.preventDefault();

              const explicitTarget = href.startsWith('#') ? null : parseRepoNavigationTarget(href);
              if (explicitTarget) {
                debugLog('[explorar:guide-link] explicit-target', {
                  sectionId: sectionMeta.id,
                  href,
                  explicitTarget,
                });
                openFileInTab(
                  explicitTarget.path,
                  explicitTarget.searchPattern,
                  explicitTarget.scrollToLine,
                  symbolScope
                );
                return;
              }

              if (searchPattern && symbolScope && symbolScope.length > 0) {
                debugLog('[explorar:guide-link] scoped-symbol-target', {
                  sectionId: sectionMeta.id,
                  searchPattern,
                  symbolScope,
                });
                openFileInTab(symbolScope[0], searchPattern, scrollToLine, symbolScope);
                return;
              }

              if (!href.startsWith('#')) {
                debugLog('[explorar:guide-link] raw-href', {
                  sectionId: sectionMeta.id,
                  href,
                });
                openFileInTab(href);
              }
            }}
          >
            {reactContent}
          </div>
          {sectionMeta.fileRecommendations &&
            (sectionMeta.fileRecommendations.readingOrder ||
              sectionMeta.fileRecommendations.docs ||
              sectionMeta.fileRecommendations.source ||
              sectionMeta.fileRecommendations.directories) &&
            createFileRecommendationsComponent(
              sectionMeta.fileRecommendations.readingOrder || [],
              sectionMeta.fileRecommendations.docs || [],
              sectionMeta.fileRecommendations.source || [],
              sectionMeta.fileRecommendations.directories || [],
              openFileInTab
            )}
          {sectionMeta.quiz && sectionMeta.quiz.length > 0 && (
            <ChapterQuiz chapterId={sectionMeta.id} questions={sectionMeta.quiz} />
          )}
        </div>
      );

      const guideSection: GuideSection = {
        id: sectionMeta.id,
        title: sectionMeta.title,
        body,
        narrativePaths,
        fileRecommendations: sectionMeta.fileRecommendations,
        quiz: sectionMeta.quiz,
        graph,
      };

      return guideSection;
    })
    .filter((section): section is GuideSection => section !== null);

  return guideSections;
}

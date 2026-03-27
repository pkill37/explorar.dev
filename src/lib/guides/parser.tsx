// Markdown parser utility for guide files
import React from 'react';
import matter from 'gray-matter';
import { marked } from 'marked';
import mermaid from 'mermaid';
import { GuideSection, FileRecommendation } from '@/lib/project-guides';
import { QuizQuestion } from '@/components/ChapterQuiz';
import ChapterQuiz from '@/components/ChapterQuiz';
import { createFileRecommendationsComponent } from '@/lib/project-guides';

// Initialize mermaid
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      darkMode: true,
    },
  });
}

// Mermaid diagram component
function MermaidDiagram({ chart, id }: { chart: string; id: string }) {
  const [svg, setSvg] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const renderDiagram = async () => {
      try {
        if (typeof window === 'undefined') return;

        const uniqueId = `mermaid-${id}-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, chart);
        setSvg(renderedSvg);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };

    renderDiagram();
  }, [chart, id]);

  if (error) {
    return (
      <div
        style={{
          padding: '16px',
          background: 'var(--vscode-inputValidation-errorBackground)',
          border: '1px solid var(--vscode-inputValidation-errorBorder)',
          borderRadius: '4px',
          color: 'var(--vscode-inputValidation-errorForeground)',
          fontSize: '12px',
        }}
      >
        <strong>Mermaid Error:</strong> {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div style={{ padding: '16px', color: 'var(--vscode-descriptionForeground)' }}>
        Rendering diagram...
      </div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}

// Custom renderer for marked to handle mermaid blocks
function createMarkdownRenderer(sectionId: string) {
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

  return renderer;
}

// Convert HTML with mermaid placeholders to React elements
function htmlToReact(html: string, sectionId: string): React.ReactNode {
  // Parse the HTML and replace mermaid placeholders with React components
  const parts: React.ReactNode[] = [];
  const div = typeof window !== 'undefined' ? document.createElement('div') : null;

  if (!div) {
    // Server-side: just return the HTML
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  div.innerHTML = html;
  const placeholders = div.querySelectorAll('.mermaid-placeholder');

  if (placeholders.length === 0) {
    // No mermaid diagrams, return simple HTML
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // Replace placeholders with React components
  let currentHTML = html;
  placeholders.forEach((placeholder, index) => {
    const chart = decodeURIComponent(placeholder.getAttribute('data-chart') || '');
    const id = placeholder.getAttribute('data-id') || `${sectionId}-${index}`;
    const placeholderHTML = placeholder.outerHTML;

    const [before, after] = currentHTML.split(placeholderHTML);
    parts.push(<div key={`html-${index}`} dangerouslySetInnerHTML={{ __html: before }} />);
    parts.push(<MermaidDiagram key={`mermaid-${index}`} chart={chart} id={id} />);
    currentHTML = after;
  });

  // Add remaining HTML
  if (currentHTML) {
    parts.push(<div key="html-final" dangerouslySetInnerHTML={{ __html: currentHTML }} />);
  }

  return <>{parts}</>;
}

// Parse section frontmatter
interface SectionFrontmatter {
  id: string;
  title: string;
  fileRecommendations?: {
    docs?: FileRecommendation[];
    source?: FileRecommendation[];
  };
  quiz?: QuizQuestion[];
}

// Parse document frontmatter
interface DocumentFrontmatter {
  guideId?: string;
  name?: string;
  description?: string;
  defaultOpenIds?: string[];
  dataStructures?: Array<{
    name: string;
    category: string;
    description: string;
    location: string;
    filePath?: string;
    lineNumber?: number;
    introduction?: string;
    usage?: string[];
    examples?: string[];
  }>;
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

      // Only add section if we have frontmatter (id and title are required)
      if (frontmatter) {
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

// Parse YAML-like frontmatter manually (simplified for our use case)
function parseSimpleYAML(yaml: string): SectionFrontmatter {
  const lines = yaml.split('\n');
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentArray: unknown[] = [];
  let currentObject: Record<string, unknown> | null = null;
  let currentNestedArray: unknown[] | null = null;
  let currentNestedArrayKey: string | null = null;
  let indentLevel = 0;
  let nestedIndentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.match(/^\s*/)?.[0].length || 0;

    // Top-level key-value
    if (indent === 0 && line.includes(':')) {
      if (currentKey && currentArray.length > 0) {
        result[currentKey] = currentArray;
        currentArray = [];
      }

      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      currentKey = key.trim();

      if (value) {
        // Simple value
        if (value.startsWith('[') && value.endsWith(']')) {
          // Inline array
          result[currentKey] = JSON.parse(value);
        } else {
          result[currentKey] = value.replace(/^['"]|['"]$/g, '');
        }
        currentKey = null;
      } else {
        // Object or array follows
        result[currentKey] = null;
      }
    }
    // Array item
    else if (trimmed.startsWith('-')) {
      const value = trimmed.substring(1).trim();

      // Check if this is a nested array item (indented more than the object level)
      if (currentNestedArray && indent > nestedIndentLevel) {
        currentNestedArray.push(value.replace(/^['"]|['"]$/g, ''));
        continue;
      }

      if (value.includes(':')) {
        // Object in array
        const obj: Record<string, unknown> = {};
        const [objKey, ...objValueParts] = value.split(':');
        const objValue = objValueParts.join(':').trim();
        obj[objKey.trim()] = objValue.replace(/^['"]|['"]$/g, '');
        currentObject = obj;
        currentArray.push(obj);
        indentLevel = indent;
        currentNestedArray = null;
        currentNestedArrayKey = null;
      } else {
        // Simple array item
        currentArray.push(value.replace(/^['"]|['"]$/g, ''));
      }
    }
    // Nested object property
    else if (indent > indentLevel && currentObject) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      const cleanKey = key.trim();

      // Check if next line starts with '-' (indicating an array follows)
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      const nextIndent = nextLine.match(/^\s*/)?.[0].length || 0;
      const nextTrimmed = nextLine.trim();

      if (!value && nextTrimmed.startsWith('-') && nextIndent > indent) {
        // This is an array property (like options:)
        currentNestedArray = [];
        currentNestedArrayKey = cleanKey;
        nestedIndentLevel = nextIndent;
        // Process the first array item on the next iteration
        continue;
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array
        currentObject[cleanKey] = JSON.parse(value);
      } else if (value) {
        currentObject[cleanKey] = value.replace(/^['"]|['"]$/g, '');
      }

      // If we have a nested array that was being built, finalize it
      if (currentNestedArray && currentNestedArrayKey && indent <= nestedIndentLevel) {
        currentObject[currentNestedArrayKey] = currentNestedArray;
        currentNestedArray = null;
        currentNestedArrayKey = null;
      }
    }
  }

  // Finalize nested array if still open
  if (currentNestedArray && currentNestedArrayKey && currentObject) {
    currentObject[currentNestedArrayKey] = currentNestedArray;
  }

  // Finalize last array
  if (currentKey && currentArray.length > 0) {
    result[currentKey] = currentArray;
  }

  return result as unknown as SectionFrontmatter;
}

/**
 * Parse guide markdown file and return GuideSection array
 */
export function parseGuideMarkdown(
  markdown: string,
  openFileInTab: (path: string, searchPattern?: string) => void
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
      const sectionMeta = parseSimpleYAML(section.frontmatter);

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

      // Convert markdown to HTML (only if content exists)
      let reactContent: React.ReactNode = null;
      if (sectionContent && sectionContent.trim().length > 0) {
        const renderer = createMarkdownRenderer(sectionMeta.id || `section-${index}`);
        marked.setOptions({ renderer });
        // marked can return string or Promise<string>, but with sync renderer it's always string
        const htmlContent = marked(sectionContent) as string;

        // Convert HTML to React (handling mermaid diagrams)
        reactContent = htmlToReact(htmlContent, sectionMeta.id || `section-${index}`);
      }

      // Build section body with content, file recommendations, and quiz
      const body: React.ReactNode = (
        <div>
          {reactContent}
          {sectionMeta.fileRecommendations &&
            (sectionMeta.fileRecommendations.docs || sectionMeta.fileRecommendations.source) &&
            createFileRecommendationsComponent(
              sectionMeta.fileRecommendations.docs || [],
              sectionMeta.fileRecommendations.source || [],
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
        fileRecommendations: sectionMeta.fileRecommendations,
        quiz: sectionMeta.quiz,
      };

      return guideSection;
    })
    .filter((section): section is GuideSection => section !== null);

  return guideSections;
}

/**
 * Extract data structures from guide markdown
 */
export function extractDataStructures(markdown: string) {
  const { data } = matter(markdown);
  const docMeta = data as DocumentFrontmatter;
  return docMeta.dataStructures || [];
}

/**
 * Extract guide metadata from markdown
 */
export function extractGuideMetadata(markdown: string) {
  const { data } = matter(markdown);
  const docMeta = data as DocumentFrontmatter;
  return {
    guideId: docMeta.guideId,
    name: docMeta.name,
    description: docMeta.description,
    defaultOpenIds: docMeta.defaultOpenIds || [],
  };
}

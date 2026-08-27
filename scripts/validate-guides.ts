/**
 * Validates that all docs/*.md guide files have correct section frontmatter.
 *
 * Checks:
 * - Doc-level frontmatter has owner, repo, defaultOpenIds
 * - Every section has id and title
 * - Every id in defaultOpenIds has a matching section id
 * - Every ```chapter-graph block has valid edge syntax and no duplicate edges
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { DOCS_DIR, listGuideMarkdownFiles } from './guide-docs';

export interface SectionMeta {
  id?: string;
  title?: string;
}

export interface GuideValidationResult {
  errors: string[];
  sections: SectionMeta[];
  graphBlocks: Array<{ code: string; line: number }>;
}

function isFenceMarker(line: string): boolean {
  const t = line.trim();
  return t.startsWith('```') || t.startsWith('~~~');
}

/** Split content into sections by --- delimiter pairs, returning frontmatter strings */
export function parseSectionIds(content: string): SectionMeta[] {
  const sections: SectionMeta[] = [];
  const lines = content.split('\n');
  let i = 0;
  let inFence = false;

  while (i < lines.length) {
    if (isFenceMarker(lines[i])) inFence = !inFence;
    if (inFence || lines[i].trim() !== '---') {
      i++;
      continue;
    }
    const sectionStart = i;
    i++; // skip opening ---
    while (i < lines.length && lines[i].trim() === '') i++;

    const fmLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '---') {
      fmLines.push(lines[i]);
      i++;
    }
    if (i < lines.length) i++; // skip closing ---

    const fm = fmLines.join('\n').trim();
    if (!fm) continue;

    // Minimal id/title extraction — match `id: value` and `title: value`
    const idMatch = fm.match(/^id:\s*(.+)$/m);
    const titleMatch = fm.match(/^title:\s*(.+)$/m);
    if (idMatch || titleMatch) {
      sections.push({
        id: idMatch?.[1].trim(),
        title: titleMatch?.[1].trim(),
      });
    } else {
      i = sectionStart + 1;
    }
  }

  return sections;
}

/** Extract all fenced code blocks of a given language with their 1-based start line numbers */
export function extractFencedBlocks(
  raw: string,
  language: string
): Array<{ code: string; line: number }> {
  const blocks: Array<{ code: string; line: number }> = [];
  const lines = raw.split('\n');
  const fence = '```' + language;
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim() === fence) {
      const startLine = i + 1; // 1-based
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ code: codeLines.join('\n'), line: startLine });
    } else {
      i++;
    }
  }

  return blocks;
}

/** Edge syntax: `source -> target : label` (label is required) */
const EDGE_RE = /^(\S+)\s*->\s*(\S+)\s*:\s*(.+)$/;

/**
 * Validate a chapter-graph block.
 * Returns an array of error strings (empty = valid).
 */
export function validateChapterGraph(graph: string, blockLine: number): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  graph
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, idx) => {
      const lineNum = blockLine + idx;
      if (!EDGE_RE.test(line)) {
        errors.push(
          `line ${lineNum}: invalid edge syntax (expected "source -> target : label"): ${line}`
        );
        return;
      }
      const m = line.match(EDGE_RE)!;
      const [, src, tgt] = m;
      const key = `${src} -> ${tgt}`;
      if (seen.has(key)) {
        errors.push(`line ${lineNum}: duplicate edge: ${key}`);
      }
      seen.add(key);
      if (src === tgt) {
        errors.push(`line ${lineNum}: self-loop: ${key}`);
      }
    });

  return errors;
}

export function validateGuideMarkdown(raw: string): GuideValidationResult {
  const { data: frontmatter, content } = matter(raw);

  const errors: string[] = [];

  // 1. Doc-level frontmatter checks
  if (!frontmatter.owner) errors.push('missing doc frontmatter: owner');
  if (!frontmatter.repo) errors.push('missing doc frontmatter: repo');
  if (!Array.isArray(frontmatter.defaultOpenIds) || frontmatter.defaultOpenIds.length === 0) {
    errors.push('missing or empty doc frontmatter: defaultOpenIds');
  }

  // 2. Section frontmatter checks
  const sections = parseSectionIds(content);

  if (sections.length === 0) {
    errors.push('no section frontmatter found — chapters will not open correctly');
  }

  for (const section of sections) {
    if (!section.id) errors.push(`section missing id (title: "${section.title}")`);
    if (!section.title) errors.push(`section missing title (id: "${section.id}")`);
  }

  // 3. defaultOpenIds coverage check
  if (Array.isArray(frontmatter.defaultOpenIds)) {
    const sectionIds = new Set(sections.map((s) => s.id));
    for (const openId of frontmatter.defaultOpenIds) {
      if (!sectionIds.has(openId)) {
        errors.push(
          `defaultOpenIds contains "${openId}" but no section has that id — chapter will never auto-open`
        );
      }
    }
  }

  // 4. Chapter-graph edge syntax check
  const graphBlocks = extractFencedBlocks(raw, 'chapter-graph');
  for (const block of graphBlocks) {
    if (!block.code.trim()) {
      errors.push(`chapter-graph block at line ${block.line}: empty graph`);
      continue;
    }
    const graphErrors = validateChapterGraph(block.code, block.line + 1);
    errors.push(...graphErrors);
  }

  return { errors, sections, graphBlocks };
}

export function main(): number {
  let errors = 0;

  const files = listGuideMarkdownFiles();

  for (const file of files) {
    const filepath = path.join(DOCS_DIR, file);
    const raw = fs.readFileSync(filepath, 'utf-8');
    const { errors: fileErrors, sections, graphBlocks } = validateGuideMarkdown(raw);

    if (fileErrors.length > 0) {
      console.error(`\n❌ ${file}:`);
      for (const err of fileErrors) {
        console.error(`   • ${err}`);
      }
      errors += fileErrors.length;
    } else {
      const chapterCount = sections.filter((s) => s.id !== 'learning-path').length;
      const graphCount = graphBlocks.length;
      console.log(
        `✓ ${file} (${chapterCount} chapters, ${graphCount} chapter-graph${graphCount !== 1 ? 's' : ''})`
      );
    }
  }

  if (errors > 0) {
    console.error(`\n${errors} guide validation error(s) found.`);
    return 1;
  } else {
    console.log(`\nAll ${files.length} guide files valid.`);
    return 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}

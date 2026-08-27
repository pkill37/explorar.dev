/**
 * check-guide-refs.ts — Guide reference consistency validator
 *
 * For every guide whose static files exist in the local corpus mirror, validates that
 * every reference inside docs/*.md resolves to a real path in the downloaded
 * tree. The repo root is derived from each guide's own frontmatter and
 * validated against curated repo config (curatedRepoId / owner / repo / revision),
 * so guide metadata cannot silently drift from the pinned curated corpus.
 *
 * Checks (hard errors → exit 1):
 *   1. fileRecommendations.readingOrder[].path — file or directory exists in repo
 *   2. fileRecommendations.source[].path   — file or directory exists in repo
 *   3. fileRecommendations.docs[].path     — file or directory exists in repo
 *   4. fileRecommendations.directories[].path — directory exists in repo
 *   4. chapter-graph edge paths            — both nodes exist in repo
 *   5. Markdown links  [text](path)        — path exists (when it looks like a repo path)
 *   6. Inline-code paths  `path/file.ext`  — path exists (relative paths only)
 *   7. Symbol names  `sym()` in descriptions — sym found in associated source file
 *
 * Checks (warnings only — do NOT exit 1):
 *   7. Line-count claims  (~N lines)       — actual wc within 30 % of claimed
 *
 * Guides whose static files are not present in the local corpus mirror are skipped with
 * a notice (non-curated or not yet downloaded).
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getCuratedRepo } from '../src/lib/curated-repos';
import { CORPUS_REPOS_DIR } from './static-asset-paths';
import { DOCS_DIR, listGuideMarkdownFiles } from './guide-docs';

// File extensions that indicate a source/doc file path (vs a generic identifier).
// Note: .s covers both lowercase and uppercase (.S) since hasKnownExt lowercases first.
const KNOWN_EXTS = new Set([
  '.c',
  '.h',
  '.cpp',
  '.cc',
  '.s', // also matches .S (assembly) after toLowerCase
  '.py',
  '.go',
  '.rs',
  '.tsx',
  '.ts',
  '.js',
  '.mjs',
  '.md',
  '.rst',
  '.txt',
  '.json',
  '.toml',
  '.yaml',
  '.yml',
  '.asm',
  '.inc',
  '.sym',
  '.list',
  '.sh',
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileRef {
  refPath: string;
  description: string;
}

export interface Section {
  id: string;
  title: string;
  readingOrderRefs: FileRef[];
  sourceRefs: FileRef[];
  docsRefs: FileRef[];
  directoryRefs: FileRef[];
  /** Raw prose text (everything between the YAML block and the next ---) */
  prose: string;
}

// ─── File-content cache (avoid re-reading the same file) ─────────────────────

const fileCache = new Map<string, string | null>();
const pathIndexCache = new Map<string, Map<string, string[]>>();

function cachedRead(absPath: string): string | null {
  if (fileCache.has(absPath)) return fileCache.get(absPath)!;
  try {
    const content = fs.readFileSync(absPath, 'utf-8');
    fileCache.set(absPath, content);
    return content;
  } catch {
    fileCache.set(absPath, null);
    return null;
  }
}

export function buildPathIndex(repoRoot: string): Map<string, string[]> {
  const cached = pathIndexCache.get(repoRoot);
  if (cached) return cached;

  const index = new Map<string, string[]>();
  const stack = [''];

  while (stack.length > 0) {
    const relDir = stack.pop()!;
    const absDir = path.join(repoRoot, relDir);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
      const key = entry.name;
      const paths = index.get(key) ?? [];
      paths.push(relPath);
      index.set(key, paths);
      if (entry.isDirectory()) {
        stack.push(relPath);
      }
    }
  }

  pathIndexCache.set(repoRoot, index);
  return index;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function resolveRepoPath(repoRoot: string, refPath: string): string | null {
  const normalized = stripNavigationSuffix(refPath).replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalized) return null;

  const exactPath = path.join(repoRoot, normalized);
  if (fs.existsSync(exactPath)) {
    return normalized;
  }

  if (normalized.includes('/')) {
    const basename = normalized.split('/').pop();
    if (!basename) return null;
    const matches = buildPathIndex(repoRoot).get(basename) ?? [];
    if (matches.length === 1) return matches[0];
    const arm64Matches = matches.filter((candidate) => /(^|\/)arm64(\/|$)/.test(candidate));
    return arm64Matches.length === 1 ? arm64Matches[0] : null;
  }

  const matches = buildPathIndex(repoRoot).get(normalized) ?? [];
  if (matches.length === 1) return matches[0];
  const arm64Matches = matches.filter((candidate) => /(^|\/)arm64(\/|$)/.test(candidate));
  return arm64Matches.length === 1 ? arm64Matches[0] : null;
}

export function refExists(repoRoot: string, refPath: string): boolean {
  return resolveRepoPath(repoRoot, refPath) !== null;
}

export function stripNavigationSuffix(refPath: string): string {
  const withoutHash = refPath.split('#')[0] || refPath;
  const lastSlash = withoutHash.lastIndexOf('/');
  const navigationColon = withoutHash.indexOf(':', lastSlash + 1);
  if (navigationColon <= lastSlash) {
    return withoutHash;
  }

  const suffix = withoutHash.slice(navigationColon + 1);
  if (/^L?\d+$/i.test(suffix) || /^[A-Za-z_][A-Za-z0-9_:.<>\-~]*$/.test(suffix)) {
    return withoutHash.slice(0, navigationColon);
  }

  return withoutHash;
}

/** Count newlines (matches `wc -l` semantics). */
function countLines(repoRoot: string, refPath: string): number | null {
  const content = cachedRead(path.join(repoRoot, refPath));
  if (content === null) return null;
  let n = 0;
  for (let i = 0; i < content.length; i++) if (content[i] === '\n') n++;
  return n;
}

function symbolInFile(repoRoot: string, filePath: string, sym: string): boolean {
  const content = cachedRead(path.join(repoRoot, filePath));
  return content !== null && content.includes(sym);
}

function hasKnownExt(p: string): boolean {
  return KNOWN_EXTS.has(path.extname(p).toLowerCase());
}

/** True when the string looks like a relative repo path or a bare file reference. */
function looksLikeRepoPath(s: string): boolean {
  if (!s || s.includes('://') || s.startsWith('#')) return false;
  return s.includes('/') || hasKnownExt(s) || s.endsWith('/');
}

export function parseClaimed(raw: string): number {
  return parseInt(raw.replace(/,/g, ''), 10);
}

/** Extract all ```<lang> … ``` blocks from raw text. */
export function extractFencedBlocks(raw: string, lang: string): Array<{ code: string }> {
  const blocks: Array<{ code: string }> = [];
  const fence = '```' + lang;
  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === fence) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ code: codeLines.join('\n') });
    } else {
      i++;
    }
  }
  return blocks;
}

// ─── Section parser ───────────────────────────────────────────────────────────

/** Returns true if the line opens or closes a fenced code block (``` or ~~~). */
export function isFenceMarker(line: string): boolean {
  const t = line.trim();
  return t.startsWith('```') || t.startsWith('~~~');
}

/** Parse guide content (after gray-matter has stripped the doc frontmatter). */
export function parseSections(content: string): Section[] {
  const sections: Section[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    // Seek opening --- (not inside a fenced block)
    let inFence = false;
    while (i < lines.length) {
      if (isFenceMarker(lines[i])) inFence = !inFence;
      if (!inFence && lines[i].trim() === '---') break;
      i++;
    }
    if (i >= lines.length) break;
    i++; // skip opening ---

    // Collect YAML frontmatter until closing ---
    // YAML frontmatter cannot contain fenced code blocks, so no fence tracking needed here.
    const fmLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '---') {
      fmLines.push(lines[i]);
      i++;
    }
    if (i < lines.length) i++; // skip closing ---

    const fm = fmLines.join('\n').trim();
    if (!fm) continue;

    const idMatch = fm.match(/^id:\s*(.+)$/m);
    const titleMatch = fm.match(/^title:\s*(.+)$/m);
    if (!idMatch) continue; // not a chapter section

    let readingOrderRefs: FileRef[] = [];
    let sourceRefs: FileRef[] = [];
    let docsRefs: FileRef[] = [];
    let directoryRefs: FileRef[] = [];
    try {
      const parsed = matter('---\n' + fm + '\n---\n').data as Record<string, unknown>;
      const fr = parsed['fileRecommendations'] as Record<string, unknown> | undefined;
      if (fr) {
        const toRefs = (arr: unknown): FileRef[] => {
          if (!Array.isArray(arr)) return [];
          return (arr as unknown[])
            .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
            .map((x) => ({
              refPath: String(x['path'] ?? ''),
              description: String(x['description'] ?? ''),
            }))
            .filter((r) => r.refPath.length > 0);
        };
        readingOrderRefs = toRefs(fr['readingOrder']);
        sourceRefs = toRefs(fr['source']);
        docsRefs = toRefs(fr['docs']);
        directoryRefs = toRefs(fr['directories']);
      }
    } catch {
      /* malformed YAML — skip fileRecommendations for this section */
    }

    // Collect prose until the next --- that is NOT inside a fenced code block.
    const proseLines: string[] = [];
    inFence = false;
    while (i < lines.length) {
      if (isFenceMarker(lines[i])) inFence = !inFence;
      if (!inFence && lines[i].trim() === '---') break;
      proseLines.push(lines[i]);
      i++;
    }

    sections.push({
      id: idMatch[1].trim(),
      title: titleMatch?.[1].trim() ?? '',
      readingOrderRefs,
      sourceRefs,
      docsRefs,
      directoryRefs,
      prose: proseLines.join('\n'),
    });
  }

  return sections;
}

// ─── Core checker ─────────────────────────────────────────────────────────────

const EDGE_RE = /^(\S+)\s*->\s*(\S+)\s*:\s*(.+)$/;
const LINE_COUNT_RE = /\(~([\d,]+)\s+lines[^)]*\)/g;
const MD_LINK_RE = /\[(?:[^\]]*)\]\(([\w./\-@:]+)\)/g;
const BACKTICK_RE = /`([^`\n]+)`/g;

export function checkGuide(
  repoRoot: string,
  sections: Section[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const section of sections) {
    const label = section.title ? `${section.id} [${section.title}]` : section.id;

    // ── 1. fileRecommendations.readingOrder paths ───────────────────────────
    for (const ref of section.readingOrderRefs) {
      if (!refExists(repoRoot, ref.refPath)) {
        errors.push(`${label}: MISSING FILE: ${ref.refPath} (fileRecommendations.readingOrder)`);
        continue;
      }
    }

    // ── 2. fileRecommendations.source paths ──────────────────────────────────
    for (const ref of section.sourceRefs) {
      if (!refExists(repoRoot, ref.refPath)) {
        errors.push(`${label}: MISSING FILE: ${ref.refPath} (fileRecommendations.source)`);
        continue; // no point checking symbols / line counts in a missing file
      }

      const isFile = hasKnownExt(ref.refPath) && !ref.refPath.endsWith('/');

      // 6. Symbols in description → search in this exact file
      if (isFile) {
        for (const m of ref.description.matchAll(/\b(\w+)\(\)/g)) {
          const sym = m[1];
          if (!symbolInFile(repoRoot, ref.refPath, sym)) {
            errors.push(`${section.id}: MISSING SYMBOL: ${sym}() not found in ${ref.refPath}`);
          }
        }
      }

      // 7. Line-count claim in description
      if (isFile) {
        for (const m of ref.description.matchAll(LINE_COUNT_RE)) {
          const claimed = parseClaimed(m[1]);
          const actual = countLines(repoRoot, ref.refPath);
          if (actual !== null && claimed > 0) {
            const pct = Math.abs(actual - claimed) / claimed;
            if (pct > 0.3) {
              warnings.push(
                `${section.id}: LINE COUNT: ${ref.refPath} claims ~${m[1]} lines, actual ${actual} (${Math.round(pct * 100)}% off)`
              );
            }
          }
        }
      }
    }

    // ── 3. fileRecommendations.docs paths ────────────────────────────────────
    for (const ref of section.docsRefs) {
      if (!refExists(repoRoot, ref.refPath)) {
        errors.push(`${label}: MISSING FILE: ${ref.refPath} (fileRecommendations.docs)`);
      }
    }

    // ── 4. fileRecommendations.directories paths ────────────────────────────
    for (const ref of section.directoryRefs) {
      if (!refExists(repoRoot, ref.refPath)) {
        errors.push(
          `${label}: MISSING DIRECTORY: ${ref.refPath} (fileRecommendations.directories)`
        );
      }
    }

    // ── 4. chapter-graph edges ───────────────────────────────────────────────
    for (const block of extractFencedBlocks(section.prose, 'chapter-graph')) {
      for (const line of block.code
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)) {
        const m = line.match(EDGE_RE);
        if (!m) continue;
        for (const edgePath of [m[1], m[2]]) {
          if (!refExists(repoRoot, edgePath)) {
            errors.push(`${section.id}: MISSING FILE: ${edgePath} (chapter-graph edge)`);
          }
        }
      }
    }

    // ── 5 + 6 + 7 (prose) ────────────────────────────────────────────────────
    // Strip fenced code blocks so we don't check example paths inside code snippets.
    const checkedPaths = new Set<string>(); // deduplicate within section
    const proseOutsideFences = stripFencedBlocks(section.prose);

    for (const proseLine of proseOutsideFences.split('\n')) {
      // 4. Markdown links
      for (const m of proseLine.matchAll(MD_LINK_RE)) {
        const refPath = m[1];
        if (!refPath || refPath.includes('://') || refPath.includes('#')) continue;
        if (!looksLikeRepoPath(refPath)) continue;
        if (checkedPaths.has(refPath)) continue;
        checkedPaths.add(refPath);
        if (!refExists(repoRoot, refPath)) {
          errors.push(`${section.id}: MISSING FILE: ${refPath} (markdown link)`);
        }
      }

      // 5. Inline-code file paths
      for (const m of proseLine.matchAll(BACKTICK_RE)) {
        const span = m[1].trim();
        if (span.startsWith('/')) continue; // absolute path — example, not a repo path
        if (!looksLikeRepoPath(span)) continue;
        if (checkedPaths.has(span)) continue;
        checkedPaths.add(span);
        if (!refExists(repoRoot, span)) {
          errors.push(`${section.id}: MISSING FILE: ${span} (inline code)`);
        }
      }

      // 7. Line-count claims in prose: [text](path) ... (~N lines)
      for (const m of proseLine.matchAll(
        /\[(?:[^\]]*)\]\(([\w./\-@:]+)\)[^\n~]*\(~([\d,]+)\s+lines[^)]*\)/g
      )) {
        const refPath = m[1];
        const claimedStr = m[2];
        if (!refPath || !claimedStr || refPath.includes('://')) continue;
        if (!hasKnownExt(refPath) || !refExists(repoRoot, refPath)) continue;
        const claimed = parseClaimed(claimedStr);
        const actual = countLines(repoRoot, refPath);
        if (actual !== null && claimed > 0) {
          const pct = Math.abs(actual - claimed) / claimed;
          if (pct > 0.3) {
            warnings.push(
              `${section.id}: LINE COUNT: ${refPath} claims ~${claimedStr} lines, actual ${actual} (${Math.round(pct * 100)}% off)`
            );
          }
        }
      }
    }
  }

  return { errors, warnings };
}

/** Remove all fenced code block content (``` ... ```) from text. */
export function stripFencedBlocks(text: string): string {
  return text.replace(/```[\w-]*\n[\s\S]*?```/g, '');
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function main(): number {
  let totalErrors = 0;
  let skipped = 0;
  let checked = 0;

  const files = listGuideMarkdownFiles();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
    const { data: fm, content } = matter(raw);

    const curatedRepoId = String(fm['curatedRepoId'] ?? '');
    const owner = String(fm['owner'] ?? '');
    const repo = String(fm['repo'] ?? '');
    const revision = String(fm['revision'] ?? '');
    const guideId = String(fm['guideId'] ?? '');
    const repoKey = `${owner}/${repo}`;

    if (!curatedRepoId || !owner || !repo || !revision || !guideId) {
      console.log(
        `⚠ skip: ${file} (missing curatedRepoId/owner/repo/revision/guideId in frontmatter)`
      );
      skipped++;
      continue;
    }

    const curatedRepo = getCuratedRepo(owner, repo);
    if (!curatedRepo) {
      console.error(`\n❌ ${file}:`);
      console.error(`   Unknown curated repo: ${repoKey}`);
      totalErrors++;
      checked++;
      continue;
    }
    if (curatedRepo.id !== curatedRepoId) {
      console.error(`\n❌ ${file}:`);
      console.error(`   curatedRepoId mismatch: ${curatedRepoId} != ${curatedRepo.id}`);
      totalErrors++;
      checked++;
      continue;
    }
    if (curatedRepo.revision !== revision) {
      console.error(`\n❌ ${file}:`);
      console.error(`   revision mismatch: ${revision} != ${curatedRepo.revision}`);
      totalErrors++;
      checked++;
      continue;
    }
    if (curatedRepo.guideId !== guideId) {
      console.error(`\n❌ ${file}:`);
      console.error(`   guideId mismatch: ${guideId} != ${curatedRepo.guideId}`);
      totalErrors++;
      checked++;
      continue;
    }

    const repoRoot = path.join(CORPUS_REPOS_DIR, owner, repo, revision);
    if (!fs.existsSync(repoRoot)) {
      console.log(`⚠ skip: ${file} (${repoKey}@${revision} not in corpus/ — not downloaded)`);
      skipped++;
      continue;
    }

    const sections = parseSections(content);
    const { errors, warnings } = checkGuide(repoRoot, sections);
    checked++;

    if (errors.length > 0 || warnings.length > 0) {
      if (errors.length > 0) {
        console.error(`\n❌ ${file}:`);
        for (const e of errors) console.error(`   ${e}`);
        totalErrors += errors.length;
      }
      if (warnings.length > 0) {
        if (errors.length === 0) console.log(`\n${file}:`);
        for (const w of warnings) console.log(`   ⚠ ${w}`);
      }
    } else {
      console.log(`✓ ${file} (${sections.length} sections)`);
    }
  }

  console.log(
    `\nChecked ${checked} guide file${checked !== 1 ? 's' : ''} (${skipped} skipped — no static files).`
  );

  if (totalErrors > 0) {
    console.error(`${totalErrors} reference error${totalErrors !== 1 ? 's' : ''} found.`);
    return 1;
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}

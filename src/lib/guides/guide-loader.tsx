// Guide Loader - Loads markdown guides and converts them to React components
import cpythonMd from './cpython.md?raw';
import linuxKernelMd from './linux-kernel.md?raw';
import glibcMd from './glibc.md?raw';
import llvmMd from './llvm.md?raw';
import { parseGuideMarkdown } from './parser';
import { GuideSection } from '@/lib/project-guides';

/**
 * Map of guide IDs to their markdown content
 */
const GUIDE_MARKDOWN: Record<string, string> = {
  'cpython-guide': cpythonMd,
  'linux-kernel-guide': linuxKernelMd,
  'glibc-guide': glibcMd,
  'llvm-guide': llvmMd,
};

/**
 * Load a guide from markdown and parse it into React components
 *
 * @param guideId - The unique identifier for the guide (e.g., 'cpython-guide')
 * @param openFileInTab - Callback function to open files in the editor
 * @returns Array of GuideSection objects with interactive React components
 * @throws Error if guide not found or parsing fails
 */
export function loadGuideFromMarkdown(
  guideId: string,
  openFileInTab: (path: string, searchPattern?: string) => void
): GuideSection[] {
  const markdown = GUIDE_MARKDOWN[guideId];

  if (!markdown) {
    throw new Error(
      `Guide not found: ${guideId}. Available guides: ${Object.keys(GUIDE_MARKDOWN).join(', ')}`
    );
  }

  return parseGuideMarkdown(markdown, openFileInTab);
}

/**
 * Get list of available guide IDs
 */
export function getAvailableGuides(): string[] {
  return Object.keys(GUIDE_MARKDOWN);
}

// Auto-discovery system for docs/ markdown guides
import matter from 'gray-matter';

// Import all guide markdown files
import pythonCpythonMd from '../../../docs/python_cpython.md?raw';
import torvaldsLinuxMd from '../../../docs/torvalds_linux.md?raw';
import llvmProjectMd from '../../../docs/llvm_project.md?raw';
import bminorGlibcMd from '../../../docs/bminor_glibc.md?raw';
import fridaFrameworkMd from '../../../docs/frida_framework.md?raw';
import jaxFrameworkMd from '../../../docs/jax_framework.md?raw';
import pytorchFrameworkMd from '../../../docs/pytorch_framework.md?raw';
import tinygradFrameworkMd from '../../../docs/tinygrad_framework.md?raw';
import golangGoMd from '../../../docs/golang_go.md?raw';
import appleXnuMd from '../../../docs/apple-oss-distributions_xnu.md?raw';

/**
 * Guide metadata extracted from frontmatter
 */
export interface GuideMetadata {
  owner: string;
  repo: string;
  defaultBranch: string;
  guideId: string;
  name: string;
  description: string;
  defaultOpenIds: string[];
}

/**
 * Guide with metadata and content
 */
export interface GuideDocument {
  metadata: GuideMetadata;
  content: string;
}

/**
 * Mapping of markdown files
 */
const DOCS_MARKDOWN: Record<string, string> = {
  'python_cpython.md': pythonCpythonMd,
  'torvalds_linux.md': torvaldsLinuxMd,
  'llvm_project.md': llvmProjectMd,
  'bminor_glibc.md': bminorGlibcMd,
  'frida_framework.md': fridaFrameworkMd,
  'jax_framework.md': jaxFrameworkMd,
  'pytorch_framework.md': pytorchFrameworkMd,
  'tinygrad_framework.md': tinygradFrameworkMd,
  'golang_go.md': golangGoMd,
  'apple-oss-distributions_xnu.md': appleXnuMd,
};

/**
 * Parse guide metadata and content from markdown
 */
function parseGuideDocument(markdown: string, filePath: string): GuideDocument {
  try {
    const { data, content } = matter(markdown);

    // Validate required fields
    const requiredFields = ['owner', 'repo', 'defaultBranch', 'guideId', 'name', 'description'];
    const missingFields = requiredFields.filter((field) => !data[field]);

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required frontmatter fields in ${filePath}: ${missingFields.join(', ')}`
      );
    }

    return {
      metadata: {
        owner: data.owner,
        repo: data.repo,
        defaultBranch: data.defaultBranch,
        guideId: data.guideId,
        name: data.name,
        description: data.description,
        defaultOpenIds: data.defaultOpenIds || [],
      },
      content,
    };
  } catch (error) {
    console.error(`Failed to parse guide document ${filePath}:`, error);
    throw error;
  }
}

/**
 * Cache for parsed guide documents
 */
let guidesCache: Map<string, GuideDocument> | null = null;

/**
 * Get all guide documents, parsed and cached
 */
export function getAllGuideDocuments(): Map<string, GuideDocument> {
  if (guidesCache) {
    return guidesCache;
  }

  guidesCache = new Map();

  for (const [filePath, markdown] of Object.entries(DOCS_MARKDOWN)) {
    try {
      const doc = parseGuideDocument(markdown, filePath);
      guidesCache.set(doc.metadata.guideId, doc);
    } catch (error) {
      console.error(`Failed to load guide from ${filePath}:`, error);
    }
  }

  return guidesCache;
}

/**
 * Get a specific guide by guideId
 */
export function getGuideDocument(guideId: string): GuideDocument | null {
  const guides = getAllGuideDocuments();
  return guides.get(guideId) || null;
}

/**
 * Get guide by owner/repo
 */
export function getGuideByRepo(owner: string, repo: string): GuideDocument | null {
  const guides = getAllGuideDocuments();

  for (const doc of guides.values()) {
    if (doc.metadata.owner === owner && doc.metadata.repo === repo) {
      return doc;
    }
  }

  return null;
}

/**
 * Get list of all available guide IDs
 */
export function getAvailableGuideIds(): string[] {
  const guides = getAllGuideDocuments();
  return Array.from(guides.keys());
}

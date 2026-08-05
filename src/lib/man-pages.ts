import { getR2BucketBaseUrl, type CuratedRepoSourceMode } from './curated-content-url';
import { getDefaultCuratedRepoSourceMode } from './curated-content-url';

const MAN_PAGE_PROJECT = 'linux';
export const MAN_PAGE_RELEASE = 'man-pages-6.18';

export type ManPageTarget = {
  kind: 'man-page';
  name: string;
  section: string;
};

export type ManPageEntry = {
  key: string;
  name: string;
  section: string;
  title: string;
  htmlPath: string;
  aliases: string[];
};

const MAN_PAGE_REF_RE = /^([A-Za-z0-9_.+\-]+)\((\d[a-zA-Z]*)\)$/;

function getManPageAssetUrl(pathname: string, sourceMode: CuratedRepoSourceMode): string {
  const cleanPath = pathname.replace(/^\/+/, '');
  if (sourceMode === 'local-filesystem') {
    return `/man-pages/${cleanPath}`;
  }

  const baseUrl = getR2BucketBaseUrl();
  if (!baseUrl) {
    return `/man-pages/${cleanPath}`;
  }
  return `${baseUrl}/man-pages/${cleanPath}`;
}

function buildManPageEntry(name: string, section: string): ManPageEntry {
  const normalizedName = name.trim();
  const normalizedSection = section.trim();
  const key = getManPageLabel(normalizedName, normalizedSection);

  return {
    key,
    name: normalizedName,
    section: normalizedSection,
    title: key,
    htmlPath: `${MAN_PAGE_PROJECT}/${MAN_PAGE_RELEASE}/man${normalizedSection}/${normalizedName}.${normalizedSection}.html`,
    aliases: [],
  };
}

export function parseManPageReference(value: string): ManPageTarget | null {
  const trimmed = value.trim().replace(/^man:/i, '');
  const match = trimmed.match(MAN_PAGE_REF_RE);
  if (!match) {
    return null;
  }

  return {
    kind: 'man-page',
    name: match[1],
    section: match[2],
  };
}

export function getManPageEntry(name: string, section: string): ManPageEntry | null {
  if (!MAN_PAGE_REF_RE.test(getManPageLabel(name, section))) {
    return null;
  }

  return buildManPageEntry(name, section);
}

export function hasManPage(name: string, section: string): boolean {
  return getManPageEntry(name, section) !== null;
}

export function getManPageLabel(name: string, section: string): string {
  return `${name}(${section})`;
}

export function getManualPageLinkAttributes(target: ManPageTarget): string {
  return `data-man-page-name="${target.name}" data-man-page-section="${target.section}"`;
}

export function buildManualPageTabPath(name: string, section: string): string {
  return `man:${getManPageLabel(name, section)}`;
}

export async function fetchManualPageHtml(
  name: string,
  section: string,
  options?: { sourceMode?: CuratedRepoSourceMode }
): Promise<{ html: string; entry: ManPageEntry }> {
  const entry = getManPageEntry(name, section);
  if (!entry) {
    throw new Error(`Manual page not found: ${getManPageLabel(name, section)}`);
  }

  const sourceMode = options?.sourceMode ?? getDefaultCuratedRepoSourceMode();
  const url = getManPageAssetUrl(entry.htmlPath, sourceMode);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load manual page ${entry.key} from ${url}`);
  }

  return {
    html: await response.text(),
    entry,
  };
}

export function getKnownManPages(): ManPageEntry[] {
  return [];
}

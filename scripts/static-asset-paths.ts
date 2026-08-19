import path from 'path';

const ROOT = process.cwd();

export const CORPUS_REPOS_DIR = path.join(ROOT, 'repos');
export const MAN_PAGES_DIR = path.join(ROOT, 'man-pages');

export const PUBLIC_REPOS_DIR = path.join(ROOT, 'public', 'repos');
export const PUBLIC_MAN_PAGES_DIR = path.join(ROOT, 'public', 'man-pages');

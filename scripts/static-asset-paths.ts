import path from 'path';

const ROOT = process.cwd();

export const CORPUS_REPOS_DIR = path.join(ROOT, 'repos');

export const PUBLIC_REPOS_DIR = path.join(ROOT, 'public', 'repos');
export const PUBLIC_AVATARS_DIR = path.join(ROOT, 'public', 'avatars');
export const PUBLIC_STAGE_MANIFEST_PATH = path.join(ROOT, 'public', 'public-stage-manifest.json');

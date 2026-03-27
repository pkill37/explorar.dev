/**
 * Platform abstraction layer for multi-environment support
 * Allows the codebase to work in both web and VSCode extension contexts
 */

export type RepositoryMode = 'curated' | 'arbitrary' | 'workspace';

export interface FileSystemProvider {
  readFile(path: string): Promise<string>;
  fileExists(path: string): Promise<boolean>;
  listDirectory(
    path: string
  ): Promise<Array<{ name: string; type: 'file' | 'directory'; path: string }>>;
}

export interface StorageProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface HttpClient {
  get(url: string, headers?: Record<string, string>): Promise<Response>;
  head(url: string, headers?: Record<string, string>): Promise<Response>;
}

export interface ConfigProvider {
  get(key: string): string | undefined;
  getRequired(key: string): string;
}

export interface PathResolver {
  join(...paths: string[]): string;
  resolve(...paths: string[]): string;
  normalize(path: string): string;
  getReposBasePath(): string;
  getWorkspaceRoot(): string | null;
  getStaticFilePath(owner: string, repo: string, branch: string, filePath: string): string;
}

export interface GuidesApiProvider {
  generateGuide(owner: string, repo: string, branch: string): Promise<unknown>;
  getGuide(owner: string, repo: string, branch: string): Promise<unknown | null>;
  isAvailable(): boolean;
}

export interface WorkspaceProvider {
  getCurrentWorkspace(): { root: string; name: string } | null;
  isWorkspaceOpen(): boolean;
}

// Platform detection
export type Platform = 'web' | 'vscode' | 'node';

let currentPlatform: Platform = 'web';

export function setPlatform(platform: Platform): void {
  currentPlatform = platform;
}

export function getPlatform(): Platform {
  return currentPlatform;
}

export function isWebPlatform(): boolean {
  return currentPlatform === 'web';
}

export function isVSCodePlatform(): boolean {
  return currentPlatform === 'vscode';
}

// Platform providers - will be injected
let fileSystemProvider: FileSystemProvider | null = null;
let storageProvider: StorageProvider | null = null;
let httpClient: HttpClient | null = null;
let configProvider: ConfigProvider | null = null;
let pathResolver: PathResolver | null = null;
let guidesApiProvider: GuidesApiProvider | null = null;
let workspaceProvider: WorkspaceProvider | null = null;

export function setFileSystemProvider(provider: FileSystemProvider): void {
  fileSystemProvider = provider;
}

export function setStorageProvider(provider: StorageProvider): void {
  storageProvider = provider;
}

export function setHttpClient(client: HttpClient): void {
  httpClient = client;
}

export function setConfigProvider(provider: ConfigProvider): void {
  configProvider = provider;
}

export function setPathResolver(resolver: PathResolver): void {
  pathResolver = resolver;
}

export function setGuidesApiProvider(provider: GuidesApiProvider): void {
  guidesApiProvider = provider;
}

export function setWorkspaceProvider(provider: WorkspaceProvider): void {
  workspaceProvider = provider;
}

export function getFileSystemProvider(): FileSystemProvider {
  if (!fileSystemProvider) {
    throw new Error('FileSystemProvider not initialized. Call setFileSystemProvider() first.');
  }
  return fileSystemProvider;
}

export function getStorageProvider(): StorageProvider {
  if (!storageProvider) {
    throw new Error('StorageProvider not initialized. Call setStorageProvider() first.');
  }
  return storageProvider;
}

export function getHttpClient(): HttpClient {
  if (!httpClient) {
    throw new Error('HttpClient not initialized. Call setHttpClient() first.');
  }
  return httpClient;
}

export function getConfigProvider(): ConfigProvider {
  if (!configProvider) {
    throw new Error('ConfigProvider not initialized. Call setConfigProvider() first.');
  }
  return configProvider;
}

export function getPathResolver(): PathResolver {
  if (!pathResolver) {
    throw new Error('PathResolver not initialized. Call setPathResolver() first.');
  }
  return pathResolver;
}

export function getGuidesApiProvider(): GuidesApiProvider | null {
  return guidesApiProvider;
}

export function getWorkspaceProvider(): WorkspaceProvider | null {
  return workspaceProvider;
}

/**
 * Web platform implementations using browser APIs
 */
import type {
  FileSystemProvider,
  HttpClient,
  ConfigProvider,
  PathResolver,
  GuidesApiProvider,
  WorkspaceProvider,
} from './index';
import {
  setPlatform,
  setFileSystemProvider,
  setHttpClient,
  setConfigProvider,
  setPathResolver,
  setGuidesApiProvider,
  setWorkspaceProvider,
} from './index';

// Web FileSystemProvider using fetch
export class WebFileSystemProvider implements FileSystemProvider {
  async readFile(path: string): Promise<string> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to read file: ${path} (${response.status})`);
    }
    return await response.text();
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      const response = await fetch(path, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listDirectory(
    _path: string
  ): Promise<Array<{ name: string; type: 'file' | 'directory'; path: string }>> {
    // For web, we typically use manifest files instead of directory listing
    // This is a placeholder - actual implementation would use manifest
    throw new Error('Directory listing not supported in web platform. Use manifest files instead.');
  }
}

// Web HttpClient using fetch
export class WebHttpClient implements HttpClient {
  async get(url: string, headers?: Record<string, string>): Promise<Response> {
    return fetch(url, { headers });
  }

  async head(url: string, headers?: Record<string, string>): Promise<Response> {
    return fetch(url, { method: 'HEAD', headers });
  }
}

// Web ConfigProvider using process.env
export class WebConfigProvider implements ConfigProvider {
  get(key: string): string | undefined {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
    return undefined;
  }

  getRequired(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Required configuration key not found: ${key}`);
    }
    return value;
  }
}

// Web PathResolver
export class WebPathResolver implements PathResolver {
  join(...paths: string[]): string {
    return paths.join('/').replace(/\/+/g, '/');
  }

  resolve(...paths: string[]): string {
    return this.join(...paths);
  }

  normalize(path: string): string {
    return path.replace(/\/+/g, '/').replace(/\/$/, '');
  }

  getReposBasePath(): string {
    return '/repos';
  }

  getWorkspaceRoot(): string | null {
    return null; // Workspace doesn't apply to web
  }

  getStaticFilePath(owner: string, repo: string, branch: string, filePath: string): string {
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    return `/repos/${owner}/${repo}/${branch}/${cleanPath}`;
  }
}

// Web GuidesApiProvider - calls proprietary API
export class WebGuidesApiProvider implements GuidesApiProvider {
  private apiUrl: string;
  private apiKey: string | null;

  constructor(apiUrl?: string, apiKey?: string) {
    this.apiUrl = apiUrl || '';
    this.apiKey = apiKey || null;
  }

  isAvailable(): boolean {
    return !!this.apiUrl && !!this.apiKey;
  }

  async generateGuide(owner: string, repo: string, branch: string): Promise<unknown> {
    if (!this.isAvailable()) {
      throw new Error('Guides API is not configured. Please set API URL and key.');
    }

    const response = await fetch(`${this.apiUrl}/guides/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ owner, repo, branch }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate guide: ${response.statusText}`);
    }

    return await response.json();
  }

  async getGuide(owner: string, repo: string, branch: string): Promise<unknown | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/guides?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 404) {
        return null;
      }

      throw new Error(`Failed to get guide: ${response.statusText}`);
    } catch (error) {
      console.error('Error fetching guide:', error);
      return null;
    }
  }
}

// Web WorkspaceProvider - returns null (workspace doesn't apply to web)
export class WebWorkspaceProvider implements WorkspaceProvider {
  getCurrentWorkspace(): { root: string; name: string } | null {
    return null;
  }

  isWorkspaceOpen(): boolean {
    return false;
  }
}

// Initialize web platform
export function initializeWebPlatform(options?: {
  guidesApiUrl?: string;
  guidesApiKey?: string;
}): void {
  setPlatform('web');
  setFileSystemProvider(new WebFileSystemProvider());
  setHttpClient(new WebHttpClient());
  setConfigProvider(new WebConfigProvider());
  setPathResolver(new WebPathResolver());
  setGuidesApiProvider(new WebGuidesApiProvider(options?.guidesApiUrl, options?.guidesApiKey));
  setWorkspaceProvider(new WebWorkspaceProvider());
}

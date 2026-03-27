/**
 * Configuration management abstraction
 * Centralizes access to environment variables and configuration
 */
import { getConfigProvider, isWebPlatform } from './platform';

class Config {
  private getConfig(key: string): string | undefined {
    if (isWebPlatform()) {
      try {
        const provider = getConfigProvider();
        return provider.get(key);
      } catch {
        // Fallback to process.env if provider not initialized
        if (typeof process !== 'undefined' && process.env) {
          return process.env[key];
        }
      }
    }
    // Fallback for web
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
    return undefined;
  }

  getSiteUrl(): string {
    return this.getConfig('NEXT_PUBLIC_SITE_URL') || 'https://explorar.dev';
  }

  getGuidesApiUrl(): string {
    return this.getConfig('NEXT_PUBLIC_GUIDES_API_URL') || '';
  }

  getGuidesApiKey(): string {
    return this.getConfig('NEXT_PUBLIC_GUIDES_API_KEY') || '';
  }

  isProduction(): boolean {
    return this.getConfig('NODE_ENV') === 'production';
  }

  isDevelopment(): boolean {
    return this.getConfig('NODE_ENV') === 'development';
  }
}

export const config = new Config();

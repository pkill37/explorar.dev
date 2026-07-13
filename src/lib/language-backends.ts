import {
  findCodeIndexSymbolsByName,
  getCodeIndexReferencesForSymbol,
  type CodeIndexSymbolEntry,
  type LoadedCodeIndex,
} from './code-index';
import type { Location, SymbolReference } from './cross-reference';

export interface BackendDefinition {
  name: string;
  kind: string;
  file: string;
  line: number;
  column: number;
  signature?: string;
  documentation?: string;
}

export interface BackendHover {
  markdown: string[];
}

export interface BackendDiagnostic {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface LanguageBackendContext {
  filePath: string;
  content: string;
  workspaceFilePaths: string[];
  includeDeclaration?: boolean;
}

export interface LanguageBackend {
  id: string;
  languageIds: string[];
  getDefinition(
    symbolName: string,
    context: LanguageBackendContext
  ): Promise<BackendDefinition | null>;
  getReferences(symbolName: string, context: LanguageBackendContext): Promise<Location[]>;
  getHover(symbolName: string, context: LanguageBackendContext): Promise<BackendHover | null>;
  getDiagnostics(context: LanguageBackendContext): Promise<BackendDiagnostic[]>;
  getDocumentSymbols(context: LanguageBackendContext): Promise<SymbolReference[]>;
}

export class LanguageBackendRegistry {
  private readonly backends = new Map<string, LanguageBackend[]>();

  register(backend: LanguageBackend): void {
    for (const languageId of backend.languageIds) {
      const registered = this.backends.get(languageId) ?? [];
      registered.push(backend);
      this.backends.set(languageId, registered);
    }
  }

  getBackends(languageId: string): LanguageBackend[] {
    return this.backends.get(languageId) ?? [];
  }
}

function normalizeSymbolQuery(symbolName: string): string {
  return symbolName
    .trim()
    .replace(/\(\)$/, '')
    .replace(/^(struct|class|enum)\s+/, '');
}

function symbolEntryToDefinition(symbol: CodeIndexSymbolEntry): BackendDefinition {
  return {
    name: symbol.name,
    kind: symbol.kind,
    file: symbol.path,
    line: symbol.startLine,
    column: symbol.startColumn,
    signature: symbol.signature ?? undefined,
    documentation: symbol.doc ?? undefined,
  };
}

export class IndexedLanguageBackend implements LanguageBackend {
  id = 'indexed';

  languageIds = ['c', 'cpp', 'python', 'typescript', 'javascript'];

  constructor(private readonly codeIndex: LoadedCodeIndex | null) {}

  async getDefinition(
    symbolName: string,
    context: LanguageBackendContext
  ): Promise<BackendDefinition | null> {
    if (!this.codeIndex) {
      return null;
    }

    const normalizedSymbol = normalizeSymbolQuery(symbolName);
    const localDefinitions = findCodeIndexSymbolsByName(this.codeIndex, normalizedSymbol, {
      path: context.filePath,
      definitionOnly: true,
      limit: 1,
    });
    const workspaceDefinitions =
      localDefinitions.length > 0
        ? localDefinitions
        : findCodeIndexSymbolsByName(this.codeIndex, normalizedSymbol, {
            definitionOnly: true,
            limit: 10,
          });
    const definition = workspaceDefinitions[0];
    return definition ? symbolEntryToDefinition(definition) : null;
  }

  async getReferences(symbolName: string, context: LanguageBackendContext): Promise<Location[]> {
    if (!this.codeIndex) {
      return [];
    }

    const normalizedSymbol = normalizeSymbolQuery(symbolName);
    const definitions = findCodeIndexSymbolsByName(this.codeIndex, normalizedSymbol, {
      definitionOnly: true,
      limit: 20,
    });
    const fallbackSymbols =
      definitions.length > 0
        ? definitions
        : findCodeIndexSymbolsByName(this.codeIndex, normalizedSymbol, { limit: 20 });

    const references = fallbackSymbols.flatMap((symbol) =>
      getCodeIndexReferencesForSymbol(
        this.codeIndex!,
        symbol.symbolId,
        Boolean(context.includeDeclaration)
      )
    );

    return Array.from(
      new Map(
        references.map((reference) => [
          `${reference.path}:${reference.line}:${reference.column}`,
          {
            file: reference.path,
            line: reference.line,
            column: reference.column,
          },
        ])
      ).values()
    );
  }

  async getHover(
    symbolName: string,
    context: LanguageBackendContext
  ): Promise<BackendHover | null> {
    if (!this.codeIndex) {
      return null;
    }

    const definition = await this.getDefinition(symbolName, context);
    if (!definition) {
      return null;
    }

    const markdown = [`**${definition.name}** \`${definition.kind}\``];
    if (definition.signature) {
      markdown.push('```c\n' + definition.signature + '\n```');
    }
    if (definition.documentation) {
      markdown.push(`*${definition.documentation}*`);
    }
    markdown.push(`Line ${definition.line} in ${definition.file.split('/').pop()}`);
    return { markdown };
  }

  async getDiagnostics(): Promise<BackendDiagnostic[]> {
    return [];
  }

  async getDocumentSymbols(): Promise<SymbolReference[]> {
    return [];
  }
}

export class HeuristicLanguageBackend implements LanguageBackend {
  id = 'heuristic';

  languageIds = ['c', 'cpp', 'python', 'typescript', 'javascript'];

  constructor(
    private readonly implementation: Pick<
      LanguageBackend,
      'getDefinition' | 'getReferences' | 'getHover' | 'getDiagnostics' | 'getDocumentSymbols'
    >
  ) {}

  getDefinition(
    symbolName: string,
    context: LanguageBackendContext
  ): Promise<BackendDefinition | null> {
    return this.implementation.getDefinition(symbolName, context);
  }

  getReferences(symbolName: string, context: LanguageBackendContext): Promise<Location[]> {
    return this.implementation.getReferences(symbolName, context);
  }

  getHover(symbolName: string, context: LanguageBackendContext): Promise<BackendHover | null> {
    return this.implementation.getHover(symbolName, context);
  }

  getDiagnostics(context: LanguageBackendContext): Promise<BackendDiagnostic[]> {
    return this.implementation.getDiagnostics(context);
  }

  getDocumentSymbols(context: LanguageBackendContext): Promise<SymbolReference[]> {
    return this.implementation.getDocumentSymbols(context);
  }
}

// Basic cross-referencing utilities for C code
// Finds function definitions, declarations, and references

export interface SymbolReference {
  name: string;
  type: 'function' | 'struct' | 'typedef' | 'macro' | 'variable';
  line: number;
  column: number;
  file: string;
  isDefinition: boolean;
  isDeclaration: boolean;
}

// Simple regex patterns for C code (not a full parser, but good enough for basic cross-referencing)
const FUNCTION_DEF_PATTERN = /^(\w+\s+)*(\w+)\s*\([^)]*\)\s*\{/;
const FUNCTION_DECL_PATTERN = /^(\w+\s+)*(\w+)\s*\([^)]*\)\s*;/;
const STRUCT_DEF_PATTERN = /^struct\s+(\w+)\s*\{/;
const STRUCT_DECL_PATTERN = /^struct\s+(\w+)\s*[;=]/;
const TYPEDEF_PATTERN = /^typedef\s+.*\s+(\w+)\s*;/;
const MACRO_PATTERN = /^#define\s+(\w+)/;

export function findSymbolsInFile(content: string, filePath: string): SymbolReference[] {
  const symbols: SymbolReference[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Skip comments and preprocessor directives (except #define)
    if (line.startsWith('//') || (line.startsWith('/*') && !line.includes('*/'))) {
      continue;
    }

    // Function definitions
    const funcDefMatch = line.match(FUNCTION_DEF_PATTERN);
    if (funcDefMatch) {
      const funcName = funcDefMatch[2];
      if (funcName && !funcName.includes('*') && !funcName.includes('(')) {
        symbols.push({
          name: funcName,
          type: 'function',
          line: lineNum,
          column: line.indexOf(funcName) + 1,
          file: filePath,
          isDefinition: true,
          isDeclaration: false,
        });
      }
    }

    // Function declarations
    const funcDeclMatch = line.match(FUNCTION_DECL_PATTERN);
    if (funcDeclMatch && !funcDefMatch) {
      const funcName = funcDeclMatch[2];
      if (funcName && !funcName.includes('*') && !funcName.includes('(')) {
        symbols.push({
          name: funcName,
          type: 'function',
          line: lineNum,
          column: line.indexOf(funcName) + 1,
          file: filePath,
          isDefinition: false,
          isDeclaration: true,
        });
      }
    }

    // Struct definitions
    const structDefMatch = line.match(STRUCT_DEF_PATTERN);
    if (structDefMatch) {
      symbols.push({
        name: structDefMatch[1],
        type: 'struct',
        line: lineNum,
        column: line.indexOf(structDefMatch[1]) + 1,
        file: filePath,
        isDefinition: true,
        isDeclaration: false,
      });
    }

    // Struct declarations
    const structDeclMatch = line.match(STRUCT_DECL_PATTERN);
    if (structDeclMatch && !structDefMatch) {
      symbols.push({
        name: structDeclMatch[1],
        type: 'struct',
        line: lineNum,
        column: line.indexOf(structDeclMatch[1]) + 1,
        file: filePath,
        isDefinition: false,
        isDeclaration: true,
      });
    }

    // Typedefs
    const typedefMatch = line.match(TYPEDEF_PATTERN);
    if (typedefMatch) {
      symbols.push({
        name: typedefMatch[1],
        type: 'typedef',
        line: lineNum,
        column: line.indexOf(typedefMatch[1]) + 1,
        file: filePath,
        isDefinition: true,
        isDeclaration: false,
      });
    }

    // Macros
    const macroMatch = line.match(MACRO_PATTERN);
    if (macroMatch) {
      symbols.push({
        name: macroMatch[1],
        type: 'macro',
        line: lineNum,
        column: line.indexOf(macroMatch[1]) + 1,
        file: filePath,
        isDefinition: true,
        isDeclaration: false,
      });
    }
  }

  return symbols;
}

export function findDefinition(
  symbolName: string,
  symbols: SymbolReference[]
): SymbolReference | null {
  return symbols.find((s) => s.name === symbolName && s.isDefinition) || null;
}

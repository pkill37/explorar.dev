import { findSymbolsInFile } from '@/lib/cross-reference';

export type EntityKind =
  | 'struct'
  | 'class'
  | 'type'
  | 'function'
  | 'enum'
  | 'interface'
  | 'macro'
  | 'variable';

export interface EntityField {
  name: string;
  type: string;
}

export interface CodeEntity {
  name: string;
  kind: EntityKind;
  fields: EntityField[];
  filePath: string;
  language: string;
}

function extractPythonEntities(
  lines: string[],
  filePath: string
): Array<CodeEntity & { line: number }> {
  const entities: Array<CodeEntity & { line: number }> = [];
  const n = lines.length;
  let i = 0;

  while (i < n) {
    const raw = lines[i];
    const t = raw.trim();
    const classM = t.match(/^class\s+(\w+)/);

    if (!classM) {
      i++;
      continue;
    }

    const name = classM[1];
    const classIndent = raw.match(/^(\s*)/)![1].length;
    const line = i + 1;
    i++;

    const fields: EntityField[] = [];
    const seen = new Set<string>();
    let inInit = false;

    while (i < n) {
      const bodyRaw = lines[i];
      const bodyT = bodyRaw.trim();
      const indent = bodyRaw.match(/^(\s*)/)![1].length;

      if (bodyT && indent <= classIndent && !bodyRaw.match(/^\s*$/)) {
        break;
      }

      if (indent === classIndent + 4 || indent === classIndent + 2) {
        const ann = bodyT.match(/^(\w+)\s*:\s*([^=\n]+?)(?:\s*=.*)?$/);
        if (ann && ann[1] !== 'def' && ann[1] !== 'class' && !seen.has(ann[1])) {
          seen.add(ann[1]);
          fields.push({ name: ann[1], type: ann[2].trim() });
        }
      }

      if (bodyT.match(/^def\s+__init__\s*\(/)) {
        inInit = true;
        i++;
        continue;
      }

      if (inInit) {
        if (bodyT && indent <= classIndent + 4 && bodyT.startsWith('def ')) {
          inInit = false;
        } else {
          const selfAnn = bodyT.match(/^self\.(\w+)\s*:\s*([^=\n]+?)(?:\s*=.*)?$/);
          const selfAssign = bodyT.match(/^self\.(\w+)\s*=/);
          if (selfAnn && !seen.has(selfAnn[1])) {
            seen.add(selfAnn[1]);
            fields.push({ name: selfAnn[1], type: selfAnn[2].trim() });
          } else if (selfAssign && !seen.has(selfAssign[1])) {
            seen.add(selfAssign[1]);
            fields.push({ name: selfAssign[1], type: '' });
          }
        }
      }

      i++;
    }

    entities.push({
      name,
      kind: 'class',
      fields: fields.slice(0, 12),
      filePath,
      language: 'python',
      line,
    });
  }

  return entities;
}

function extractTSEntities(
  lines: string[],
  filePath: string
): Array<CodeEntity & { line: number }> {
  const entities: Array<CodeEntity & { line: number }> = [];
  const n = lines.length;
  let i = 0;

  while (i < n) {
    const t = lines[i].trim();

    const ifaceM = t.match(/^(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+\S+)?\s*\{/);
    if (ifaceM) {
      const name = ifaceM[1];
      const line = i + 1;
      const fields: EntityField[] = [];
      i++;
      let depth = 1;
      while (i < n && depth > 0) {
        const body = lines[i].trim();
        depth += (body.match(/\{/g) || []).length;
        depth -= (body.match(/\}/g) || []).length;
        if (depth > 0 && body && !body.startsWith('/')) {
          const field = body.match(/^(?:readonly\s+)?(\w+)\??\s*:\s*([^;,]+)/);
          if (field) {
            fields.push({ name: field[1], type: field[2].trim() });
          }
        }
        i++;
      }
      entities.push({
        name,
        kind: 'interface',
        fields: fields.slice(0, 12),
        filePath,
        language: 'typescript',
        line,
      });
      continue;
    }

    const typeObjM = t.match(/^(?:export\s+)?type\s+(\w+)\s*=\s*\{/);
    if (typeObjM) {
      const name = typeObjM[1];
      const line = i + 1;
      const fields: EntityField[] = [];
      i++;
      let depth = 1;
      while (i < n && depth > 0) {
        const body = lines[i].trim();
        depth += (body.match(/\{/g) || []).length;
        depth -= (body.match(/\}/g) || []).length;
        if (depth > 0 && body && !body.startsWith('/')) {
          const field = body.match(/^(?:readonly\s+)?(\w+)\??\s*:\s*([^;,]+)/);
          if (field) {
            fields.push({ name: field[1], type: field[2].trim() });
          }
        }
        i++;
      }
      entities.push({
        name,
        kind: 'type',
        fields: fields.slice(0, 12),
        filePath,
        language: 'typescript',
        line,
      });
      continue;
    }

    const enumM = t.match(/^(?:export\s+)?(?:const\s+)?enum\s+(\w+)\s*\{/);
    if (enumM) {
      const name = enumM[1];
      const line = i + 1;
      const fields: EntityField[] = [];
      i++;
      let depth = 1;
      while (i < n && depth > 0) {
        const body = lines[i].trim();
        depth += (body.match(/\{/g) || []).length;
        depth -= (body.match(/\}/g) || []).length;
        if (depth > 0 && body && !body.startsWith('/')) {
          const val = body.match(/^(\w+)\s*(?:=\s*[^,]+)?\s*,?/);
          if (val) {
            fields.push({ name: val[1], type: '' });
          }
        }
        i++;
      }
      entities.push({
        name,
        kind: 'enum',
        fields: fields.slice(0, 12),
        filePath,
        language: 'typescript',
        line,
      });
      continue;
    }

    const classM = t.match(/^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classM) {
      const name = classM[1];
      const line = i + 1;
      const fields: EntityField[] = [];
      i++;
      let depth = 1;
      while (i < n && depth > 0) {
        const body = lines[i].trim();
        depth += (body.match(/\{/g) || []).length;
        depth -= (body.match(/\}/g) || []).length;
        if (depth === 1 && body && !body.startsWith('/')) {
          const prop = body.match(
            /^(?:(?:private|public|protected|readonly|static|declare|override)\s+)*(\w+)\??\s*:\s*([^;=]+)/
          );
          if (prop && !prop[1].match(/^(?:constructor|get|set|async|static|abstract)$/)) {
            fields.push({ name: prop[1], type: prop[2].trim() });
          }
        }
        i++;
      }
      entities.push({
        name,
        kind: 'class',
        fields: fields.slice(0, 12),
        filePath,
        language: 'typescript',
        line,
      });
      continue;
    }

    i++;
  }

  return entities;
}

export function extractEntities(
  filePath: string,
  content: string
): Array<CodeEntity & { line: number }> {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const lines = content.split('\n').slice(0, 1500);

  if (ext === 'py') {
    return extractPythonEntities(lines, filePath);
  }

  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
    return extractTSEntities(lines, filePath);
  }

  const cFamilyExtensions = new Set([
    'c',
    'cc',
    'cpp',
    'cxx',
    'h',
    'hh',
    'hpp',
    'hxx',
    'inc',
    'inl',
  ]);
  if (cFamilyExtensions.has(ext)) {
    return findSymbolsInFile(content, filePath)
      .filter(
        (symbol) =>
          symbol.isDefinition &&
          (symbol.type === 'function' ||
            symbol.type === 'struct' ||
            symbol.type === 'class' ||
            symbol.type === 'typedef')
      )
      .map((symbol) => ({
        name: symbol.name,
        kind:
          symbol.type === 'typedef'
            ? 'type'
            : symbol.type === 'macro'
              ? 'macro'
              : symbol.type === 'variable'
                ? 'variable'
                : symbol.type,
        fields:
          symbol.members?.slice(0, 12).map((member) => ({
            name: member.name,
            type: member.type,
          })) ?? [],
        filePath,
        language: 'c-family',
        line: symbol.line,
      }));
  }

  return [];
}

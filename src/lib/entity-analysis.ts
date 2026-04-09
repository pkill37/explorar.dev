/**
 * Entity extraction: structs, classes, enums with their fields.
 * Used to build the entities diagram view.
 */

export type EntityKind = 'struct' | 'class' | 'enum' | 'interface' | 'type';

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

// ─── C / C++ ────────────────────────────────────────────────────────────────

function extractCEntities(lines: string[], filePath: string): CodeEntity[] {
  const entities: CodeEntity[] = [];
  const n = lines.length;
  let i = 0;

  while (i < n) {
    const t = lines[i].trim();

    // struct Foo { or typedef struct Foo {
    const structM =
      t.match(/^(?:typedef\s+)?struct\s+([A-Za-z_]\w*)\s*\{/) ||
      t.match(/^struct\s+([A-Za-z_]\w*)\s*\{/);
    if (structM) {
      const name = structM[1];
      const fields: EntityField[] = [];
      i++;
      let depth = 1;
      while (i < n && depth > 0) {
        const line = lines[i].trim();
        depth += (line.match(/\{/g) || []).length;
        depth -= (line.match(/\}/g) || []).length;
        if (depth > 0) {
          // field line: "type name;" or "type *name;" or "type name[N];"
          const field = line.match(/^([\w\s*]+?)\s+\**(\w+)\s*(?:\[.*?\])?\s*;/);
          if (field && !line.startsWith('/') && !line.startsWith('*')) {
            fields.push({ type: field[1].trim().replace(/\s+/g, ' '), name: field[2] });
          }
        }
        i++;
      }
      if (name !== '{') {
        entities.push({
          name,
          kind: 'struct',
          fields: fields.slice(0, 12),
          filePath,
          language: 'c',
        });
      }
      continue;
    }

    // enum Foo {
    const enumM = t.match(/^(?:typedef\s+)?enum\s+([A-Za-z_]\w*)\s*\{/);
    if (enumM) {
      const name = enumM[1];
      const fields: EntityField[] = [];
      i++;
      let depth = 1;
      while (i < n && depth > 0) {
        const line = lines[i].trim();
        depth += (line.match(/\{/g) || []).length;
        depth -= (line.match(/\}/g) || []).length;
        if (depth > 0 && line && !line.startsWith('/') && !line.startsWith('*')) {
          // enum value: "NAME," or "NAME = VALUE,"
          const val = line.match(/^([A-Za-z_]\w*)\s*(?:=\s*[^,]+)?\s*,?/);
          if (val) fields.push({ type: '', name: val[1] });
        }
        i++;
      }
      entities.push({ name, kind: 'enum', fields: fields.slice(0, 12), filePath, language: 'c' });
      continue;
    }

    i++;
  }

  return entities;
}

// ─── Python ─────────────────────────────────────────────────────────────────

function extractPythonEntities(lines: string[], filePath: string): CodeEntity[] {
  const entities: CodeEntity[] = [];
  const n = lines.length;
  let i = 0;

  while (i < n) {
    const t = lines[i].trim();
    const raw = lines[i];

    const classM = t.match(/^class\s+(\w+)/);
    if (classM) {
      const name = classM[1];
      const classIndent = raw.match(/^(\s*)/)![1].length;
      i++;

      // Scan class body for __init__ and type annotations
      const fields: EntityField[] = [];
      const seen = new Set<string>();

      // First look for class-level type annotations: name: type
      // Then look for self.name assignments in __init__
      let inInit = false;

      while (i < n) {
        const bodyRaw = lines[i];
        const bodyT = bodyRaw.trim();
        const indent = bodyRaw.match(/^(\s*)/)![1].length;

        // Stop when we return to class indent level with non-empty content
        if (bodyT && indent <= classIndent && !bodyRaw.match(/^\s*$/)) break;

        // Class-level annotation: name: Type  (not inside a method)
        if (indent === classIndent + 4 || indent === classIndent + 2) {
          const ann = bodyT.match(/^(\w+)\s*:\s*([^=\n]+?)(?:\s*=.*)?$/);
          if (ann && ann[1] !== 'def' && ann[1] !== 'class' && !seen.has(ann[1])) {
            seen.add(ann[1]);
            fields.push({ name: ann[1], type: ann[2].trim() });
          }
        }

        // Detect __init__
        if (bodyT.match(/^def\s+__init__\s*\(/)) {
          inInit = true;
          i++;
          continue;
        }

        // Inside __init__: self.name = ...  or  self.name: Type = ...
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
      });
      continue;
    }

    i++;
  }

  return entities;
}

// ─── TypeScript / JavaScript ─────────────────────────────────────────────────

function extractTSEntities(lines: string[], filePath: string): CodeEntity[] {
  const entities: CodeEntity[] = [];
  const n = lines.length;
  let i = 0;

  while (i < n) {
    const t = lines[i].trim();

    // interface Foo { or export interface Foo {
    const ifaceM = t.match(/^(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+\S+)?\s*\{/);
    if (ifaceM) {
      const name = ifaceM[1];
      const fields: EntityField[] = [];
      i++;
      let depth = 1;
      while (i < n && depth > 0) {
        const line = lines[i].trim();
        depth += (line.match(/\{/g) || []).length;
        depth -= (line.match(/\}/g) || []).length;
        if (depth > 0 && line && !line.startsWith('/')) {
          // name: Type;  or  name?: Type;  or  readonly name: Type;
          const field = line.match(/^(?:readonly\s+)?(\w+)\??\s*:\s*([^;,]+)/);
          if (field) fields.push({ name: field[1], type: field[2].trim() });
        }
        i++;
      }
      entities.push({
        name,
        kind: 'interface',
        fields: fields.slice(0, 12),
        filePath,
        language: 'typescript',
      });
      continue;
    }

    // type Foo = { ... }  (object type alias)
    const typeObjM = t.match(/^(?:export\s+)?type\s+(\w+)\s*=\s*\{/);
    if (typeObjM) {
      const name = typeObjM[1];
      const fields: EntityField[] = [];
      i++;
      let depth = 1;
      while (i < n && depth > 0) {
        const line = lines[i].trim();
        depth += (line.match(/\{/g) || []).length;
        depth -= (line.match(/\}/g) || []).length;
        if (depth > 0 && line && !line.startsWith('/')) {
          const field = line.match(/^(?:readonly\s+)?(\w+)\??\s*:\s*([^;,]+)/);
          if (field) fields.push({ name: field[1], type: field[2].trim() });
        }
        i++;
      }
      entities.push({
        name,
        kind: 'type',
        fields: fields.slice(0, 12),
        filePath,
        language: 'typescript',
      });
      continue;
    }

    // enum Foo {
    const enumM = t.match(/^(?:export\s+)?(?:const\s+)?enum\s+(\w+)\s*\{/);
    if (enumM) {
      const name = enumM[1];
      const fields: EntityField[] = [];
      i++;
      let depth = 1;
      while (i < n && depth > 0) {
        const line = lines[i].trim();
        depth += (line.match(/\{/g) || []).length;
        depth -= (line.match(/\}/g) || []).length;
        if (depth > 0 && line && !line.startsWith('/')) {
          const val = line.match(/^(\w+)\s*(?:=\s*[^,]+)?\s*,?/);
          if (val) fields.push({ name: val[1], type: '' });
        }
        i++;
      }
      entities.push({
        name,
        kind: 'enum',
        fields: fields.slice(0, 12),
        filePath,
        language: 'typescript',
      });
      continue;
    }

    // class Foo {
    const classM = t.match(/^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classM) {
      const name = classM[1];
      const fields: EntityField[] = [];
      i++;
      let depth = 1;
      while (i < n && depth > 0) {
        const line = lines[i].trim();
        depth += (line.match(/\{/g) || []).length;
        depth -= (line.match(/\}/g) || []).length;
        if (depth === 1 && line && !line.startsWith('/')) {
          // class property: name: Type;  or  private name: Type;
          const prop = line.match(
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
      });
      continue;
    }

    i++;
  }

  return entities;
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function extractEntities(filePath: string, content: string): CodeEntity[] {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  // Limit to 1500 lines for perf
  const lines = content.split('\n').slice(0, 1500);

  if (ext === 'c' || ext === 'h' || ext === 'cc' || ext === 'cpp' || ext === 'cxx') {
    return extractCEntities(lines, filePath);
  }
  if (ext === 'py') {
    return extractPythonEntities(lines, filePath);
  }
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
    return extractTSEntities(lines, filePath);
  }
  return [];
}

// ─── Color per kind ──────────────────────────────────────────────────────────

export const ENTITY_KIND_COLOR: Record<EntityKind, string> = {
  struct: '#38bdf8', // sky blue
  class: '#a78bfa', // violet
  enum: '#fb923c', // orange
  interface: '#4ade80', // green
  type: '#f472b6', // pink
};

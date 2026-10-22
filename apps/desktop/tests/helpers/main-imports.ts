// What main, the data process and the statement decoder may import at run time (design of desktop-data-process, §5;
// the decoder: provider-modules, decision 8). A checker over file
// texts: the run-time import graph from an entry, following relative imports inside src/; type-only imports do not
// count, and a `?modulePath` import is another process (a fork target), not followed. Where the graph enters a
// workspace package, the import itself is checked; core's own layers (packages/core/tests/layers.test.ts) keep its
// shared/ and providers/ folders free of query code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

export type Files = ReadonlyMap<string, string>; // posix path relative to src/ → text

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|(?<!:)\/\/.*$/gm, '');

/** Specifiers this file imports at run time: no `import type`, no `export type`, no clause of type-only names. */
export function runtimeImports(text: string): string[] {
  const code = stripComments(text);
  const out: string[] = [];
  for (const m of code.matchAll(/(?:^|[\s;])(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    const [, , typeOnly, clause = '', spec = ''] = m;
    if (typeOnly) continue;
    const names = /^\{([^}]*)\}$/.exec(clause.trim())?.[1];
    if (names !== undefined && names.split(',').map((n) => n.trim()).filter(Boolean).every((n) => n.startsWith('type '))) continue;
    out.push(spec);
  }
  for (const m of code.matchAll(/(?:^|[\s;])import\s*['"]([^'"]+)['"]/g)) out.push(m[1]!);
  for (const m of code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]!);
  return out;
}

type Edge = { from: string; spec: string; target: string | null };

/** Every run-time import reachable from `entry`: `target` is the src/ file a relative import resolves to, else null. */
export function graph(files: Files, entry: string): Edge[] {
  const edges: Edge[] = [];
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const spec of runtimeImports(files.get(file) ?? '')) {
      if (spec.endsWith('?modulePath')) continue;
      if (!spec.startsWith('.')) {
        edges.push({ from: file, spec, target: null });
        continue;
      }
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      if (!files.has(target)) continue; // JSON dictionaries and the like
      edges.push({ from: file, spec, target });
      if (!seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return edges;
}

/** Core folders main may reach at run time, and where from. */
function coreAllowed(from: string, spec: string): boolean {
  if (/^@mono\/core\/(shared|providers)\//.test(spec)) return true;
  // The dev smoke (it migrates the file it opens); DbAccess and the encryption take the open as a dependency.
  if (/^@mono\/core\/storage\//.test(spec)) return from === 'main/smoke.ts';
  // The reserve limits zod shares with core; nothing in main calls the module's functions.
  if (spec === '@mono/core/read/reserves') return from === 'shared/allowance.ts';
  return false;
}

const LIBSQL_IN_MAIN: ReadonlySet<string> = new Set(['main/index.ts', 'main/smoke.ts']);

/** The graph of main/index.ts: no query code (core beyond the allowed folders), no data process code, libsql only where allowed. */
export function mainViolations(files: Files): string[] {
  const out: string[] = [];
  for (const { from, spec, target } of graph(files, 'main/index.ts')) {
    if (target?.startsWith('data/')) out.push(`${from}: reaches the data process's code (${target})`);
    else if (target?.startsWith('decoder/')) out.push(`${from}: reaches the decoder's code (${target})`);
    else if (spec.startsWith('@mono/core/') && !coreAllowed(from, spec)) out.push(`${from}: imports ${spec} at run time`);
    else if (spec === '@mono/db-libsql' && !LIBSQL_IN_MAIN.has(from)) out.push(`${from}: imports @mono/db-libsql`);
  }
  return out;
}

/** The graph of data/process.ts: no Electron, no network, no main or worker code. */
export function dataViolations(files: Files): string[] {
  const out: string[] = [];
  for (const { from, spec, target } of graph(files, 'data/process.ts')) {
    if (spec === 'electron') out.push(`${from}: imports electron`);
    else if (target && /^(main|net|worker)\//.test(target)) out.push(`${from}: reaches ${target}`);
  }
  return out;
}

/** Packages the decoder may load: its schemas, the unzip, the XML reader, pdf.js's legacy build; core's pure helpers. */
const DECODER_PACKAGES = /^(zod|fflate|fast-xml-parser|pdfjs-dist\/legacy\/build\/pdf(\.worker)?\.mjs|@mono\/core\/shared\/.+)$/;

/**
 * The graph of decoder/process.ts: no Electron, no network, no main, worker or data process code, no database; of
 * packages only DECODER_PACKAGES (core's providers/types.ts is imported for types only, which do not count).
 */
export function decoderViolations(files: Files): string[] {
  const out: string[] = [];
  for (const { from, spec, target } of graph(files, 'decoder/process.ts')) {
    if (target && /^(main|net|worker|data)\//.test(target)) out.push(`${from}: reaches ${target}`);
    else if (!target && !spec.startsWith('.') && !DECODER_PACKAGES.test(spec)) out.push(`${from}: imports ${spec}`);
  }
  return out;
}

export function readSrc(dir = SRC, base = dir): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'renderer') for (const [k, v] of readSrc(p, base)) out.set(k, v);
    } else if (e.name.endsWith('.ts')) out.set(path.relative(base, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8'));
  }
  return out;
}

// Reading src/ as texts for the structure tests (providers-boundary, layers): files by path and their imports.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SRC = fileURLToPath(new URL('../src/', import.meta.url));

export type Files = ReadonlyMap<string, string>; // posix path relative to src/ → text

// `//` after `:` is a URL (https://…), not a comment.
export const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|(?<!:)\/\/.*$/gm, '');

export function importsOf(text: string): string[] {
  const out: string[] = [];
  for (const re of [/(?:^|\s)(?:import|export)\s[^'";]*?\sfrom\s*['"]([^'"]+)['"]/g, /(?:^|\s)import\s*['"]([^'"]+)['"]/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g]) {
    for (const m of stripComments(text).matchAll(re)) if (m[1]) out.push(m[1]);
  }
  return out;
}

/** Relative imports of `file`, resolved to paths relative to src/. */
export function localImports(file: string, text: string): string[] {
  return importsOf(text)
    .filter((s) => s.startsWith('.'))
    .map((s) => path.posix.normalize(path.posix.join(path.posix.dirname(file), s)));
}

export function readTree(dir: string, base = dir): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) for (const [k, v] of readTree(p, base)) out.set(k, v);
    else if (e.name.endsWith('.ts')) out.set(path.relative(base, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8'));
  }
  return out;
}

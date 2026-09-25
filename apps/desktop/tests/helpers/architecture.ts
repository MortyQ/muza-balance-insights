// Layer rules of the renderer (Feature-Sliced Design, our variant), as a checker over file texts, so the rules can be
// tested against the real tree and against small broken trees that must fail.
import path from 'node:path';

/** Higher imports lower only. */
export const LAYERS = ['shared', 'entities', 'features', 'widgets', 'pages', 'app'] as const;
export type Layer = (typeof LAYERS)[number];

/** Packages the renderer may import (anything else — electron, node:*, a new dependency — is a finding). */
export const ALLOWED_PACKAGES: ReadonlyArray<RegExp> = [
  /^vue$/,
  /^vue-router$/,
  /^pinia$/,
  /^@mono\/core\/currency$/,
  /^~icons\/lucide\/[a-z0-9-]+$/,
  /^@fontsource-variable\/manrope\/wght\.css$/,
];

/** The only file that reads window.balance. */
export const BRIDGE_FILE = 'shared/api/balance.ts';

export type Files = ReadonlyMap<string, string>; // path relative to src/renderer/src, posix → text

type Place = { layer: Layer; slice: string };

/** app is one slice; shared is split into segments (api, config, lib, ui); the rest into slices. */
export function placeOf(file: string): Place | null {
  const [layer, slice] = file.split('/');
  if (!layer || !(LAYERS as ReadonlyArray<string>).includes(layer)) return null;
  if (layer === 'app') return { layer, slice: 'app' };
  if (!slice || !file.includes('/', layer.length + 1)) return null; // a file directly in the layer folder
  return { layer: layer as Layer, slice };
}

export function importsOf(text: string): string[] {
  const out: string[] = [];
  for (const re of [/(?:^|\s)(?:import|export)\s[^'";]*?\sfrom\s*['"]([^'"]+)['"]/g, /(?:^|\s)import\s*['"]([^'"]+)['"]/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g]) {
    for (const m of text.matchAll(re)) if (m[1]) out.push(m[1]);
  }
  return out;
}

const rank = (l: Layer) => LAYERS.indexOf(l);
const hasIndex = (files: Files, dir: string) => files.has(`${dir}/index.ts`);

export function violations(files: Files): string[] {
  const found: string[] = [];
  for (const [file, text] of files) {
    if (!/\.(ts|vue)$/.test(file)) continue;
    if (file === 'env.d.ts') continue;
    const from = placeOf(file);
    if (!from) {
      found.push(`${file}: not inside a slice of a layer (${LAYERS.join(', ')})`);
      continue;
    }

    for (const spec of importsOf(text)) {
      const where = `${file} → ${spec}`;
      if (spec.startsWith('.')) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
        const to = placeOf(target);
        if (!to || to.layer !== from.layer || to.slice !== from.slice) found.push(`${where}: a relative import leaves its slice (use @/<layer>/<slice>)`);
      } else if (spec.startsWith('@/')) {
        const target = spec.slice(2);
        const to = placeOf(`${target}/x`);
        if (!to || to.layer === 'app') {
          found.push(`${where}: not a slice`);
          continue;
        }
        if (target !== `${to.layer}/${to.slice}`) found.push(`${where}: deep import — only the slice's index.ts is public`);
        else if (!hasIndex(files, target)) found.push(`${where}: the slice has no index.ts`);
        if (to.layer === from.layer && to.slice === from.slice) found.push(`${where}: own slice through @/ (use a relative import)`);
        else if (rank(to.layer) > rank(from.layer)) found.push(`${where}: ${from.layer} must not import the higher layer ${to.layer}`);
        else if (to.layer === from.layer && to.layer !== 'shared') found.push(`${where}: slices of one layer must not import each other`);
      } else if (spec.startsWith('@contract/')) {
        if (!/^@contract\/[a-z-]+\.ts$/.test(spec)) found.push(`${where}: @contract/ is for the files of src/shared only`);
      } else if (!ALLOWED_PACKAGES.some((re) => re.test(spec))) {
        found.push(`${where}: package not allowed in the renderer`);
      }
      if (spec === '@/shared/api' && !file.includes('/api/') && file !== 'app/listeners.ts') {
        found.push(`${where}: calls to main go through an api/ segment`);
      }
    }

    if (/\bwindow\b[^;\n]*\bbalance\b|\bbalance\b[^;\n]*\bwindow\b/.test(text) && file !== BRIDGE_FILE) found.push(`${file}: reads window.balance (only ${BRIDGE_FILE} does)`);
    if (/\bdefineStore\(/.test(text) && !file.includes('/store/')) found.push(`${file}: a Pinia store outside a store/ segment`);
    if (file.endsWith('/index.ts') && file.split('/').length === 3 && from.layer !== 'app') {
      const code = text.split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('//'));
      if (code.some((l) => !/^export (type )?(\{[^}]*\}|\*) from (['"])\.\/[^'"]+\3;$/.test(l))) found.push(`${file}: a public API only re-exports`);
    }
  }
  return found;
}

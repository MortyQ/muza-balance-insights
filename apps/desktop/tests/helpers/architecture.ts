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
  /^vue-i18n$/,
  /^@mono\/core\/currency$/,
  /^~icons\/lucide\/[a-z0-9-]+$/,
  /^@fontsource-variable\/manrope\/wght\.css$/,
];

/** Packages allowed only inside shared/ui — the muzakit-copy component library — never elsewhere in the renderer. */
export const UI_ONLY_PACKAGES: ReadonlyArray<RegExp> = [/^reka-ui$/, /^@internationalized\/date$/];

/**
 * Domain slices: one slice split into sub-features, one per first-level folder, plus `shared/` for what they have in
 * common, plus root files that may compose sub-features. Sub-features never import each other or the domain's root
 * (index.ts and root files); `shared/` imports no sub-feature and no root file.
 */
export const DOMAIN_SLICES: ReadonlyArray<string> = ['features/settings', 'features/integrations'];

/** The only file that reads window.balance. */
export const BRIDGE_FILE = 'shared/api/balance.ts';

export type Files = ReadonlyMap<string, string>; // path relative to src/renderer/src, posix → text

type Place = { layer: Layer; slice: string };

/** app is one slice; shared is split into segments (api, config, layout, lib, ui); the rest into slices. */
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

/** The sub-feature folder of a file inside a domain slice; null for a file at the domain's root (index.ts, root files). */
function subFeatureOf(file: string): string | null {
  const parts = file.split('/');
  return parts.length > 3 ? parts[2]! : null;
}

/** A relative import inside a domain slice that crosses sub-features the wrong way, or ''. */
function domainViolation(file: string, target: string): string {
  const from = subFeatureOf(file);
  const to = subFeatureOf(target);
  if (from === null) return '';
  if (to === null) return 'a sub-feature must not import its domain index.ts or root files';
  if (from === 'shared' && to !== 'shared') return `shared/ of a domain must not import its sub-feature ${to}`;
  if (from !== 'shared' && to !== from && to !== 'shared') return `sub-features of a domain must not import each other (${from} → ${to}); share through shared/`;
  return '';
}
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
        else if (DOMAIN_SLICES.includes(`${from.layer}/${from.slice}`)) {
          const bad = domainViolation(file, target);
          if (bad) found.push(`${where}: ${bad}`);
        }
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
        // A file of src/shared, or a folder's index.ts there (i18n: the dictionaries behind it).
        if (!/^@contract\/[a-z0-9-]+(\/index)?\.ts$/.test(spec)) found.push(`${where}: @contract/ is for the files of src/shared only`);
      } else if (!ALLOWED_PACKAGES.some((re) => re.test(spec))) {
        if (UI_ONLY_PACKAGES.some((re) => re.test(spec)) && file.startsWith('shared/ui/')) {
          // reka-ui and @internationalized/date are allowed, but only inside shared/ui.
        } else {
          found.push(`${where}: package not allowed in the renderer`);
        }
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

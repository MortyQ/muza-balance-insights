import type { BankId } from './types.ts';

/**
 * A logo is optional: drop `entities/bank/assets/<id>.svg` (or .png / .webp) and it replaces the monogram at the next build.
 * Local files only — the prod CSP allows images from the app itself and nothing else.
 */
const LOGOS = import.meta.glob('./assets/*.{svg,png,webp}', { eager: true, query: '?url', import: 'default' });

export function bankLogo(id: BankId): string | null {
  const hit = Object.entries(LOGOS).find(([file]) => /\/([^/]+)\.\w+$/.exec(file)?.[1] === id);
  return hit?.[1] ?? null;
}

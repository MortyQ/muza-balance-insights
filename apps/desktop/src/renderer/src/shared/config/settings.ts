// Sections of the settings screen, in menu order. The section is `query.section` of the settings route.
import { ROUTE } from './routes.ts';

export const SETTINGS_SECTIONS = [
  'people',
  'connections',
  'lock',
  'storage',
  'network',
  'data',
  'auto-sync',
  'updates',
  'appearance',
  'language',
  'about',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

const isSection = (v: unknown): v is SettingsSection => SETTINGS_SECTIONS.some((s) => s === v);

/** The section a route query asks for; anything else (none, unknown, repeated) opens the first. */
export function settingsSection(q: unknown): SettingsSection {
  return isSection(q) ? q : 'people';
}

/**
 * A link to «Connections», scrolled to the history download (`query.focus`), its start date set to `from` (Kyiv
 * YYYY-MM-DD) when given. The section ignores a date it would not accept.
 */
export function importLink(from?: string): { name: typeof ROUTE.settings; query: Record<string, string> } {
  return { name: ROUTE.settings, query: { section: 'connections', focus: 'import', ...(from ? { from } : {}) } };
}

/** What a settings route query asks of the history download: focus it, and from which date. */
export function importRequest(query: Readonly<Record<string, unknown>>): { focus: boolean; from: string | null } {
  return { focus: query.focus === 'import', from: typeof query.from === 'string' ? query.from : null };
}

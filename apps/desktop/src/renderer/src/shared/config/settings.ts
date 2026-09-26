// Sections of the settings screen, in menu order. The section is `query.section` of the settings route.
export const SETTINGS_SECTIONS = ['people', 'connections', 'storage', 'network', 'data', 'updates', 'about'] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

const isSection = (v: unknown): v is SettingsSection => SETTINGS_SECTIONS.some((s) => s === v);

/** The section a route query asks for; anything else (none, unknown, repeated) opens the first. */
export function settingsSection(q: unknown): SettingsSection {
  return isSection(q) ? q : 'people';
}

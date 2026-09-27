import type { SettingsSection } from '@/shared/config';
import { NAV_GROUPS } from './constants.ts';

const ORDER: SettingsSection[] = NAV_GROUPS.flatMap((g) => g.items.flatMap((i) => (i.section === null ? [] : [i.section])));

/** The section an arrow key moves to: menu order, wrapping, never the disabled item. */
export function nextSection(current: SettingsSection, delta: 1 | -1): SettingsSection {
  const i = ORDER.indexOf(current);
  return ORDER[(i + delta + ORDER.length) % ORDER.length] ?? current;
}

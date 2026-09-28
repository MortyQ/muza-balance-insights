import type { MessageKey } from '@contract/i18n/index.ts';
import type { ThemePref } from '@contract/theme.ts';
import type { SegmentOption } from '@/shared/ui';

/** `label` is a dictionary key; the section translates it. */
export const THEME_OPTIONS = [
  { label: 'settings.theme.system', value: 'system', icon: 'lucide:monitor' },
  { label: 'settings.theme.light', value: 'light', icon: 'lucide:sun' },
  { label: 'settings.theme.dark', value: 'dark', icon: 'lucide:moon' },
] satisfies (SegmentOption<ThemePref> & { label: MessageKey })[];

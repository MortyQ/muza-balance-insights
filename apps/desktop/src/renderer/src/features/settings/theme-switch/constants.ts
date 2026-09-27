import type { ThemePref } from '@contract/theme.ts';
import type { SegmentOption } from '@/shared/ui';

export const THEME_OPTIONS = [
  { label: 'Как в системе', value: 'system', icon: 'lucide:monitor' },
  { label: 'Светлая', value: 'light', icon: 'lucide:sun' },
  { label: 'Тёмная', value: 'dark', icon: 'lucide:moon' },
] satisfies SegmentOption<ThemePref>[];

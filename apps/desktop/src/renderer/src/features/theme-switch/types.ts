import type { Ref } from 'vue';
import type { ThemePref } from '@contract/theme.ts';

export interface UseThemeReturn {
  /** null until main has answered. */
  theme: Readonly<Ref<ThemePref | null>>;
  error: Readonly<Ref<string>>;
  select: (theme: ThemePref) => Promise<void>;
}

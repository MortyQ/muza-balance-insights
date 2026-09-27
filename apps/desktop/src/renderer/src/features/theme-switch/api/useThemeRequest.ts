import type { ThemePref } from '@contract/theme.ts';
import { balanceApi } from '@/shared/api';

export function useThemeRequest(): { get: () => Promise<ThemePref>; set: (theme: ThemePref) => Promise<ThemePref> } {
  return {
    get: () => balanceApi.getTheme(),
    set: (theme) => balanceApi.setTheme(theme),
  };
}

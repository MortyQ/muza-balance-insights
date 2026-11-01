import type { MessageKey } from '@contract/i18n/index.ts';
import type { CategoryKind } from '@contract/api.ts';

/** The kinds in menu order, with their names and colours (theme.css `--kind-*`). */
export const KINDS: ReadonlyArray<{ kind: CategoryKind; label: MessageKey; color: string }> = [
  { kind: 'essential', label: 'entities.categoryKind.essential', color: 'var(--kind-essential)' },
  { kind: 'wants', label: 'entities.categoryKind.wants', color: 'var(--kind-wants)' },
  { kind: 'savings', label: 'entities.categoryKind.savings', color: 'var(--kind-left)' },
];

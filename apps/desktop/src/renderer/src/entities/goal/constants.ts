import type { LimitStateName } from '@contract/api.ts';

/** The look of a state; `ahead` — on track yet ahead of its plan: neutral, never «On track». */
export type StateLookName = LimitStateName | 'ahead';
import type { MessageKey } from '@contract/i18n/index.ts';

/** A state in words, an icon and a colour: never colour alone. */
export const STATE_LOOK: Readonly<Record<StateLookName, { label: MessageKey; icon: string; fill: string; chip: string }>> = {
  ok: { label: 'entities.goal.state.ok', icon: 'lucide:check', fill: 'var(--primary)', chip: 'bg-success-subtle text-success' },
  ahead: { label: 'entities.goal.aheadSoft', icon: 'lucide:trending-up', fill: 'var(--primary)', chip: 'bg-surface-sunken text-foreground-secondary' },
  attention: { label: 'entities.goal.state.attention', icon: 'lucide:circle-alert', fill: 'var(--warning)', chip: 'bg-warning-muted text-warning-foreground dark:bg-warning-subtle dark:text-warning' },
  exceeded: { label: 'entities.goal.state.exceeded', icon: 'lucide:circle-alert', fill: 'var(--danger)', chip: 'bg-danger-subtle text-danger' },
};

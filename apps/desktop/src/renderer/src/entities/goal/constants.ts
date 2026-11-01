import type { LimitStateName } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

/** A state in words, an icon and a colour: never colour alone. */
export const STATE_LOOK: Readonly<Record<LimitStateName, { label: MessageKey; icon: string; fill: string; chip: string }>> = {
  ok: { label: 'entities.goal.state.ok', icon: 'lucide:check', fill: 'var(--primary)', chip: 'bg-success-subtle text-success' },
  attention: { label: 'entities.goal.state.attention', icon: 'lucide:circle-alert', fill: 'var(--warning)', chip: 'bg-warning-subtle text-warning-foreground' },
  exceeded: { label: 'entities.goal.state.exceeded', icon: 'lucide:circle-alert', fill: 'var(--danger)', chip: 'bg-danger-subtle text-danger' },
};

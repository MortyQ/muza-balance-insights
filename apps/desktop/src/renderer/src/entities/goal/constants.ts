import type { LimitStateName } from '@contract/api.ts';

/**
 * The look of a state; `ahead` — on track yet ahead of its plan: neutral, never «On track»; `strong` — in attention and
 * far ahead (a look between `attention` and `exceeded`, the state itself stays `attention`).
 */
export type StateLookName = LimitStateName | 'ahead' | 'strong';

/** `strong` from the pace: spent is at least this many times what the plan expects by today. */
export const STRONG_PACE = 2;
/** `strong` from the forecast: the shown forecast is at least this many times the amount. */
export const STRONG_FORECAST = 1.5;
import type { MessageKey } from '@contract/i18n/index.ts';

/** A state in words, an icon and a colour: never colour alone. */
export const STATE_LOOK: Readonly<Record<StateLookName, { label: MessageKey; icon: string; fill: string; chip: string }>> = {
  ok: { label: 'entities.goal.state.ok', icon: 'lucide:check', fill: 'var(--primary)', chip: 'bg-success-subtle text-success' },
  ahead: { label: 'entities.goal.aheadSoft', icon: 'lucide:trending-up', fill: 'var(--primary)', chip: 'bg-surface-sunken text-foreground-secondary' },
  attention: { label: 'entities.goal.state.attention', icon: 'lucide:circle-alert', fill: 'var(--warning)', chip: 'bg-warning-muted text-warning-foreground dark:bg-warning-subtle dark:text-warning' },
  strong: { label: 'entities.goal.state.attention', icon: 'lucide:circle-alert', fill: 'var(--warning-strong)', chip: 'bg-warning-strong/12 text-warning-strong dark:bg-warning-strong/10' },
  exceeded: { label: 'entities.goal.state.exceeded', icon: 'lucide:circle-alert', fill: 'var(--danger)', chip: 'bg-danger-subtle text-danger' },
};

import type { InsightSeverity } from '@contract/api.ts';

/** More / less than usual, as «What's unusual» colours them: orange more, blue less, never red / green. */
export const TONE_TEXT = {
  up: 'text-[color-mix(in_oklch,var(--series-orange)_72%,var(--foreground))]',
  down: 'text-[color-mix(in_oklch,var(--series-blue)_72%,var(--foreground))]',
  neutral: 'text-foreground-muted',
  good: 'text-success',
  bad: 'text-danger',
} as const;

/** The shown month's bar; the usual months' bars are a quiet grey. */
export const TONE_FILL = {
  up: 'bg-[color-mix(in_oklch,var(--series-orange)_80%,transparent)]',
  down: 'bg-[color-mix(in_oklch,var(--series-blue)_80%,transparent)]',
  neutral: 'bg-[color-mix(in_oklch,var(--foreground)_55%,transparent)]',
} as const;

/** A severity mark: a soft tint, the stronger the more it weighs. */
export const SEVERITY_CHIP: Readonly<Record<InsightSeverity, string>> = {
  high: 'bg-[color-mix(in_oklch,var(--series-orange)_18%,transparent)] text-[color-mix(in_oklch,var(--series-orange)_72%,var(--foreground))]',
  medium: 'bg-[color-mix(in_oklch,var(--series-orange)_8%,transparent)] text-foreground-secondary',
  low: 'bg-surface-sunken text-foreground-muted',
};

import type { ImportProgress } from '@contract/progress.ts';

/** Phases while an import is running (the start button turns into «Остановить»). */
export const RUNNING_PHASES: ReadonlyArray<ImportProgress['phase']> = ['starting', 'accounts', 'windows', 'retry', 'rederive'];

/** Phases that end an import: the numbers may have changed. */
export const FINISHED_PHASES: ReadonlyArray<ImportProgress['phase']> = ['done', 'cancelled', 'error'];

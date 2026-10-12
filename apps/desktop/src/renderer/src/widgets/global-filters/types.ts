import type { ComputedRef, ShallowRef } from 'vue';
import type { ParticipantFilterMode } from '@/entities/participant';

/** The parts of the filter row whose widths decide whether the person buttons fit in its middle. */
export interface FilterRowParts {
  /** The row itself (its content box). */
  row: Readonly<ShallowRef<HTMLElement | null>>;
  /**
   * The month picker and the currency menu: the left side without the person select, so switching modes does not change
   * the answer.
   */
  left: Readonly<ShallowRef<HTMLElement | null>>;
  /** The sync status on the right. */
  right: Readonly<ShallowRef<HTMLElement | null>>;
  /** A hidden copy of the person buttons: their width even while the select is shown. */
  center: Readonly<ShallowRef<HTMLElement | null>>;
}

export interface FilterRowWidths {
  row: number;
  left: number;
  right: number;
  center: number;
}

export interface UseParticipantLayoutReturn {
  mode: ComputedRef<ParticipantFilterMode>;
}

/** The sync status on the right of the home filters, ready to render (`syncStatusView`). */
export type SyncStatusView = {
  icon: 'spinner' | 'warning' | null;
  /** Read out on change (role="status"): the same for every tick of one phase, so it is announced once per phase. */
  text: string;
  /** «42%» while windows download; shown, not announced. */
  percent: string;
  /** What went wrong: for screen readers here, and the same text in the tooltip. */
  note: string;
  /** On hover; '' = none. */
  tooltip: string;
};

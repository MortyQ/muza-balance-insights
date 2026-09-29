import type { ComputedRef, ShallowRef } from 'vue';
import type { ParticipantFilterMode } from '@/entities/participant';

/** The parts of the filter row whose widths decide whether the person buttons fit in its middle. */
export interface FilterRowParts {
  /** The row itself (its content box). */
  row: Readonly<ShallowRef<HTMLElement | null>>;
  /** The month picker: the left side without the person select, so switching modes does not change the answer. */
  left: Readonly<ShallowRef<HTMLElement | null>>;
  /** «Updated …» on the right. */
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

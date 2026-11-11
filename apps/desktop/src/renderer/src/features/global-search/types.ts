import type { ComputedRef, Ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import type { YearMonth } from '@/shared/lib';

export type SearchGroupId = 'transactions' | 'payees' | 'categories' | 'recurring';

/** One result row: what it shows and where it opens. */
export interface SearchItemView {
  /** Unique over the whole list: `<group>:<key>`. */
  id: string;
  group: SearchGroupId;
  icon: string;
  title: string;
  caption: string;
  /** '' — no amount. */
  amount: string;
  also: string[];
  incoming: boolean;
  to: RouteLocationRaw;
  /** The month the global filter switches to on opening; null — leave it. */
  month: YearMonth | null;
}

export interface SearchGroupView {
  id: SearchGroupId;
  title: string;
  items: SearchItemView[];
}

/** The input's state for the screen: nothing typed, waiting, failed, or results (possibly none). */
export type SearchStatus = 'idle' | 'loading' | 'error' | 'done';

export interface UseGlobalSearchReturn {
  open: Ref<boolean>;
  input: Ref<string>;
  status: ComputedRef<SearchStatus>;
  groups: ComputedRef<SearchGroupView[]>;
  /** The flat list the arrows walk, in the groups' order. */
  items: ComputedRef<SearchItemView[]>;
  /** The highlighted row's index in `items`; -1 — none. */
  active: Ref<number>;
  /** What the input was taken as: the dates and the amount, '' — just text. */
  understood: ComputedRef<string>;
  /** «Showing 50 of 120»; '' — every match is listed. */
  more: ComputedRef<string>;
  /** The arrows, Enter and Escape on the input. */
  onKey: (e: KeyboardEvent) => void;
  pick: (item: SearchItemView) => void;
}

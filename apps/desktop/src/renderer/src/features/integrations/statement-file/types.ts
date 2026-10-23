import type { ComputedRef, Ref } from 'vue';
import type { OpenStatementResult, StatementComparisonView, StatementTargetInput } from '@contract/api.ts';
import type { SubmitState } from '../shared/types.ts';

export type OpenedStatement = Extract<OpenStatementResult, { opened: true }>;

/** The account picked for one account of the file: a card of the connection, or a new card. */
export type TargetChoice = string | 'new';

export type ComparisonState =
  | { status: 'loading' }
  | { status: 'ready'; comparisons: StatementComparisonView[] }
  | { status: 'error'; message: string };

/** «Upload statement» / «Check against a statement» in a connection row, step by step. */
export type UploadState =
  | { step: 'idle' }
  | { step: 'opening' }
  | { step: 'problem'; message: string }
  | { step: 'opened'; file: OpenedStatement; comparison: ComparisonState }
  | { step: 'writing'; file: OpenedStatement; comparison: ComparisonState }
  | { step: 'done'; message: string };

export interface UseStatementUploadReturn {
  state: Readonly<Ref<UploadState>>;
  /** One per account of the file, in the file's order. */
  targets: Ref<TargetChoice[]>;
  /** The card type of a new card, one per account of the file (the bank's types). */
  newTypes: Ref<string[]>;
  /** What the file would add right now: every comparison without a block, and new rows in at least one. */
  canAdd: ComputedRef<boolean>;
  open: () => Promise<void>;
  add: () => Promise<void>;
}

export interface UseFileConnectReturn {
  submit: Readonly<Ref<SubmitState>>;
  /** true = added. */
  save: () => Promise<boolean>;
}

export type { StatementTargetInput };

import type { ComputedRef, Ref } from 'vue';
import type { OpenStatementResult, StatementComparisonView, StatementTargetInput } from '@contract/api.ts';
import type { SubmitState } from '../shared/types.ts';

export type OpenedStatement = Extract<OpenStatementResult, { opened: true }>;

/** The account picked for the file: a card of the connection, or a new card. */
export type TargetChoice = string | 'new';

export type ComparisonState =
  | { status: 'loading' }
  | { status: 'ready'; comparison: StatementComparisonView }
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
  target: Ref<TargetChoice>;
  /** The card type of a new card (the bank's types). */
  newType: Ref<string>;
  /** What the file would add right now: a comparison without a block and with new rows. */
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

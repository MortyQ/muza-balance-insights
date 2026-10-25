import type { ConnectionView, OpenStatementResult, ProviderId } from '@contract/api.ts';

/** A connection the file may go to, with what the list shows. */
export type ConnectionOption = { connection: Readonly<ConnectionView>; label: string };

/**
 * The data screens' upload: main opens the file (dialog or drop) and names its bank; then a connection of that bank is
 * taken (the only file one), picked (several, or a token one to check against), or added (none); then the comparison.
 */
export type QuickUploadState =
  | { step: 'idle' }
  | { step: 'opening' }
  | { step: 'problem'; message: string }
  | { step: 'choose'; statementId: string; provider: ProviderId; files: ConnectionOption[]; tokens: ConnectionOption[]; busy: boolean }
  | { step: 'ready'; connection: Readonly<ConnectionView>; opened: Readonly<OpenStatementResult> };

import type { ProviderId, UploadFileView } from '@contract/api.ts';

/** Where the sheet was opened from: a connection's «Upload from <date>» names its bank and the date the file should start. */
export type UploadRequest = { connectionId?: number; provider?: ProviderId; from?: string };

/**
 * The upload sheet: main opens the files (dialog or drop) and matches each account to the connection that has it; the
 * user picks a person for each account no connection has; one «Import» writes every file whose accounts all have one.
 */
export type QuickUploadState =
  | { step: 'idle' }
  | { step: 'opening'; request: UploadRequest }
  | { step: 'problem'; message: string; request: UploadRequest }
  | {
      step: 'review';
      request: UploadRequest;
      uploadId: string;
      files: UploadFileView[];
      /** Per file, per account: the person picked for an account no connection has; null for a matched one or none yet. */
      choices: Array<Array<number | null>>;
      busy: boolean;
      /** Why the last «Import» was refused, or ''. */
      error: string;
    }
  | { step: 'done'; message: string; request: UploadRequest };

/** The sheet's summary: accounts ready to write, waiting for a person, only checked, and the rows to add. */
export type UploadSummary = { ready: number; waiting: number; added: number };

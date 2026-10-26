import type {
  AddConnectionInput,
  AddConnectionResult,
  CommitStatementResult,
  CommitUploadResult,
  OpenUploadResult,
  UploadChoices,
  CompareStatementResult,
  ConnectionAccountView,
  OpenStatementResult,
  RemoveConnectionResult,
  SetAccountEnabledResult,
  StatementTargetInput,
} from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useConnectionsRequest(): {
  addConnection: (input: AddConnectionInput) => Promise<AddConnectionResult>;
  setToken: (connectionId: number, token: string, remember: boolean) => Promise<{ stored: 'secure' | 'memory' }>;
  remove: (connectionId: number) => Promise<RemoveConnectionResult>;
  listAccounts: (connectionId: number) => Promise<ConnectionAccountView[]>;
  setAccountEnabled: (accountId: string, enabled: boolean) => Promise<SetAccountEnabledResult>;
  openStatement: (connectionId: number) => Promise<OpenStatementResult>;
  openUpload: (connectionId?: number) => Promise<OpenUploadResult>;
  openDroppedUpload: (files: File[]) => Promise<OpenUploadResult>;
  commitUpload: (uploadId: string, choices: UploadChoices) => Promise<CommitUploadResult>;
  compareStatement: (statementId: string, targets: Array<StatementTargetInput | null>) => Promise<CompareStatementResult>;
  commitStatement: (statementId: string, targets: StatementTargetInput[]) => Promise<CommitStatementResult>;
} {
  return {
    addConnection: (input) => balanceApi.addConnection(input),
    setToken: (connectionId, token, remember) => balanceApi.setConnectionToken(connectionId, token, remember),
    remove: (connectionId) => balanceApi.removeConnection(connectionId),
    listAccounts: (connectionId) => balanceApi.listConnectionAccounts(connectionId),
    setAccountEnabled: (accountId, enabled) => balanceApi.setAccountEnabled(accountId, enabled),
    openStatement: (connectionId) => balanceApi.openStatement(connectionId),
    openUpload: (connectionId) => (connectionId === undefined ? balanceApi.openUpload() : balanceApi.openUpload(connectionId)),
    openDroppedUpload: (files) => balanceApi.openDroppedUpload(files),
    commitUpload: (uploadId, choices) => balanceApi.commitUpload(uploadId, choices),
    compareStatement: (statementId, targets) => balanceApi.compareStatement(statementId, targets),
    commitStatement: (statementId, targets) => balanceApi.commitStatement(statementId, targets),
  };
}

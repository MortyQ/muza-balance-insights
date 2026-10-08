import type {
  AddConnectionInput,
  AddConnectionResult,
  CommitStatementResult,
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
  compareStatement: (statementId: string, target: StatementTargetInput) => Promise<CompareStatementResult>;
  commitStatement: (statementId: string, target: StatementTargetInput) => Promise<CommitStatementResult>;
} {
  return {
    addConnection: (input) => balanceApi.addConnection(input),
    setToken: (connectionId, token, remember) => balanceApi.setConnectionToken(connectionId, token, remember),
    remove: (connectionId) => balanceApi.removeConnection(connectionId),
    listAccounts: (connectionId) => balanceApi.listConnectionAccounts(connectionId),
    setAccountEnabled: (accountId, enabled) => balanceApi.setAccountEnabled(accountId, enabled),
    openStatement: (connectionId) => balanceApi.openStatement(connectionId),
    compareStatement: (statementId, target) => balanceApi.compareStatement(statementId, target),
    commitStatement: (statementId, target) => balanceApi.commitStatement(statementId, target),
  };
}

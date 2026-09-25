// The only place in the renderer that touches window.balance (the preload's contextBridge object).
// Slices call main through their own api/ wrappers over this; tests/architecture.test.ts checks that nothing else reads window.balance.
import type { BalanceApi } from '@contract/api.ts';

export const balanceApi: BalanceApi = (window as unknown as { balance: BalanceApi }).balance;

import { ROUTE } from './routes.ts';

/** A link to the «Budget» screen; `sheet` — opened on the budget sheet (home's «Set a budget»). */
export function budgetLink(sheet = false): { name: typeof ROUTE.budget; query: Record<string, string> } {
  return { name: ROUTE.budget, query: sheet ? { sheet: 'budget' } : {} };
}

/** What a budget route query asks: the sheet open. */
export function budgetRequest(query: Readonly<Record<string, unknown>>): { sheet: boolean } {
  return { sheet: query.sheet === 'budget' };
}

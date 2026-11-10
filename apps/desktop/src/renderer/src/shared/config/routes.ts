// Route names, so any layer can navigate without importing app/router.
export const ROUTE = {
  analytics: 'analytics',
  budget: 'budget',
  category: 'category',
  connect: 'connect',
  dbRecovery: 'db-recovery',
  fopTax: 'fop-tax',
  home: 'home',
  income: 'income',
  insights: 'insights',
  lock: 'lock',
  recurring: 'recurring',
  planning: 'planning',
  settings: 'settings',
} as const satisfies Record<string, string>;

export type RouteName = (typeof ROUTE)[keyof typeof ROUTE];

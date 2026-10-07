// Route names, so any layer can navigate without importing app/router.
export const ROUTE = {
  analytics: 'analytics',
  category: 'category',
  connect: 'connect',
  dbRecovery: 'db-recovery',
  home: 'home',
  income: 'income',
  lock: 'lock',
  recurring: 'recurring',
  planning: 'planning',
  settings: 'settings',
} as const satisfies Record<string, string>;

export type RouteName = (typeof ROUTE)[keyof typeof ROUTE];

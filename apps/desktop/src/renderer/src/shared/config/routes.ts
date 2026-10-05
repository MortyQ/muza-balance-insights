// Route names, so any layer can navigate without importing app/router.
export const ROUTE = {
  analytics: 'analytics',
  connect: 'connect',
  dbRecovery: 'db-recovery',
  home: 'home',
  lock: 'lock',
  settings: 'settings',
} as const satisfies Record<string, string>;

export type RouteName = (typeof ROUTE)[keyof typeof ROUTE];

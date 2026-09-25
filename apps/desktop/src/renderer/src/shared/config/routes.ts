// Route names, so any layer can navigate without importing app/router.
export const ROUTE = {
  connect: 'connect',
  home: 'home',
  settings: 'settings',
} as const satisfies Record<string, string>;

export type RouteName = (typeof ROUTE)[keyof typeof ROUTE];

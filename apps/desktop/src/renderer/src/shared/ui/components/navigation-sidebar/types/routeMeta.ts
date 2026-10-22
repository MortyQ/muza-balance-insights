// copied from muzakit/libs/ui/src (2026-10-22); changes: ui/README.md
/**
 * Base interface for route meta fields used by NavigationSidebar tree builder.
 * Extend this in your app's RouteMeta interface.
 *
 * @example
 * // app/routes/types/types.ts
 * Extend it in the app's RouteMeta (Balance: the example import is dropped, the architecture test reads import lines).
 * export interface RouteMeta extends SidebarRouteMeta { ... }
 */
export interface SidebarRouteMeta {
  /**
     * Nesting path using "/" separator.
     * "Analytics/Quarterly" → root > Analytics > Quarterly > item
     */
  menuGroup?: string
  /** Icon for the root-level group node */
  menuGroupIcon?: string
  /** Sort order for the root-level group node */
  menuGroupOrder?: number
  /**
     * Per-segment icon/order overrides.
     * { "Quarterly": { icon: "lucide:calendar", order: 1 } }
     */
  menuGroupMeta?: Record<string, { icon?: string, order?: number }>
  /** Label shown in sidebar (overrides route title) */
  menuTitle?: string
  /** Icon for leaf item */
  menuIcon?: string
  /** Badge string shown on item */
  menuBadge?: string
  /** Sort order for leaf item. Default: 999 */
  menuOrder?: number
}

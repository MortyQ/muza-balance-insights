// copied from muzakit/libs/ui/src (2026-10-22); changes: ui/README.md
import { ref, watchEffect } from "vue";

import type { SidebarLabels } from "./types";

import type { SidebarInstance, SidebarOptions } from "./types";

const STORAGE_PREFIX = "ui-sidebar";

const DEFAULT_LABELS: SidebarLabels = {
  nav: "Main navigation",
  collapse: "Collapse sidebar",
  expand: "Expand sidebar",
  closeMenu: "Close menu",
};

function loadCollapsed(key: string): boolean {
  try {
    return localStorage.getItem(`${key}:collapsed`) === "true";
  }
  catch {
    return false;
  }
}

function saveCollapsed(key: string, value: boolean): void {
  try {
    localStorage.setItem(`${key}:collapsed`, String(value));
  }
  catch { /* noop — storage unavailable */
  }
}

function loadExpandedItems(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${key}:expanded`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set<string>(parsed) : new Set();
  }
  catch {
    return new Set();
  }
}

function saveExpandedItems(key: string, value: Set<string>): void {
  try {
    localStorage.setItem(`${key}:expanded`, JSON.stringify([...value]));
  }
  catch { /* noop — storage unavailable */
  }
}

/**
 * Factory function that creates an isolated sidebar instance.
 * Each call returns independent reactive state — no module-level singletons.
 *
 * @example
 * const sidebar = createSidebar({
 *   items: computed(() => getMenuItems(authStore)),
 *   brandName: "My App",
 *   persistentQueryParams: ["brand", "channel"],
 * });
 */
export function createSidebar(options: SidebarOptions): SidebarInstance {
  const resolvedOptions: Required<Omit<SidebarOptions, "items" | "forceCollapsed">> = {
    brandName: options.brandName ?? "",
    logoUrl: options.logoUrl ?? "",
    storageKey: options.storageKey ?? STORAGE_PREFIX,
    persistCollapse: options.persistCollapse ?? true,
    persistentQueryParams: options.persistentQueryParams ?? [],
    labels: options.labels ?? (() => DEFAULT_LABELS),
  };

  const isCollapsed = ref(false);
  const isMobileOpen = ref(false);
  const expandedItems = ref<Set<string>>(new Set());

  // SSR-safe lazy init — typeof window check prevents crash in server environments
  if (resolvedOptions.persistCollapse && typeof window !== "undefined") {
    isCollapsed.value = loadCollapsed(resolvedOptions.storageKey);
    expandedItems.value = loadExpandedItems(resolvedOptions.storageKey);

    watchEffect(() => {
      saveCollapsed(resolvedOptions.storageKey, isCollapsed.value);
    });

    watchEffect(() => {
      saveExpandedItems(resolvedOptions.storageKey, expandedItems.value);
    });
  }

  return {
    items: options.items,
    isCollapsed,
    isForcedCollapsed: options.forceCollapsed ?? ref(false),
    isMobileOpen,
    expandedItems,
    options: resolvedOptions,
    toggleCollapse: () => {
      isCollapsed.value = !isCollapsed.value;
    },
    toggleMobile: () => {
      isMobileOpen.value = !isMobileOpen.value;
    },
  };
}

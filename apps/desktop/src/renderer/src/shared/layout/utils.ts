import type { SideNavGroup } from './types.ts';

/** The item an arrow key moves to: menu order, wrapping, never a disabled item. */
export function nextItem<T extends string>(groups: ReadonlyArray<SideNavGroup<T>>, current: T, delta: 1 | -1): T {
  const order = groups.flatMap((g) => g.items.flatMap((i) => (i.id === null ? [] : [i.id])));
  const i = order.indexOf(current);
  return order[(i + delta + order.length) % order.length] ?? current;
}

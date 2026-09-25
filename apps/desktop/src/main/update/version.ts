// Release versions are plain x.y.z (no pre-release tags: releases are published as regular ones).
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseVersion(v: string): [number, number, number] | null {
  const m = VERSION.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** true only when `candidate` is strictly newer than `current`; anything unparsable is never newer. */
export function isNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

// Checks a dictionary against the reference one: what JSON does not give (tsc sees only the reference's keys).

/** Leaf path → text. Anything but nested objects and strings is a problem. */
export function flatten(dict: unknown, problems: string[], prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof dict !== 'object' || dict === null || Array.isArray(dict)) {
    problems.push(`${prefix || '(root)'}: expected an object`);
    return out;
  }
  for (const [k, v] of Object.entries(dict)) {
    const key = `${prefix}${k}`;
    if (typeof v === 'string') out.set(key, v);
    else if (typeof v === 'object' && v !== null && !Array.isArray(v)) for (const [kk, vv] of flatten(v, problems, `${key}.`)) out.set(kk, vv);
    else problems.push(`${key}: expected a string or an object`);
  }
  return out;
}

const placeholders = (text: string): string[] => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? ''))].sort();
const pluralForms = (text: string): number => text.split('|').length;

export function dictionaryProblems(reference: unknown, dict: unknown, locale: string): string[] {
  const problems: string[] = [];
  const ref = flatten(reference, problems);
  const own = flatten(dict, problems);
  for (const [key, text] of own) {
    if (text.trim() === '') problems.push(`${locale}: ${key} is empty`);
    const base = ref.get(key);
    if (base === undefined) {
      problems.push(`${locale}: ${key} is not in the reference`);
      continue;
    }
    if (placeholders(text).join() !== placeholders(base).join()) problems.push(`${locale}: ${key} placeholders differ`);
    if (pluralForms(text) !== pluralForms(base)) problems.push(`${locale}: ${key} plural forms differ`);
  }
  for (const key of ref.keys()) if (!own.has(key)) problems.push(`${locale}: ${key} is missing`);
  return problems;
}

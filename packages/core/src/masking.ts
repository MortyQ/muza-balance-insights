// Description masking for the analysis copy (analysis/analysis.sqlite): only bank templates survive verbatim,
// everything else becomes '[other]' plus the shape class. What counts as a template is the provider's knowledge
// (providers/<id>/rules.ts); the placeholders and classes are the copy's contract (providers/types.ts).
import { rulesFor } from './providers/rules.ts';
import type { MaskedDescription, ProviderId } from './providers/types.ts';

export { JAR_PLACEHOLDER, OTHER_PLACEHOLDER, type DescClass, type MaskedDescription } from './providers/types.ts';

/**
 * @param jarTitles titles of the user's jars: a description equal to one of them is a jar top-up
 *   seen from the card side and becomes '[jar]'.
 */
export function maskDescription(
  raw: string,
  jarTitles: ReadonlySet<string>,
  provider: ProviderId,
): MaskedDescription {
  return rulesFor(provider).maskDescription(raw, { jarTitles });
}

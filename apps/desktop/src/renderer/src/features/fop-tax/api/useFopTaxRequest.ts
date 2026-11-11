import type { FopTaxOverview, FopTaxQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useFopTaxRequest(): {
  fetchFopTax: (q: FopTaxQuery) => Promise<FopTaxOverview>;
  /** The kept answer to the same query (readCache), if any. */
  peekFopTax: (q: FopTaxQuery) => { data: FopTaxOverview; fresh: boolean } | null;
} {
  return {
    fetchFopTax: (q) => balanceApi.getFopTaxOverview(q),
    peekFopTax: (q) => readCache.peek<FopTaxOverview>(readKey('getFopTaxOverview', [q])),
  };
}

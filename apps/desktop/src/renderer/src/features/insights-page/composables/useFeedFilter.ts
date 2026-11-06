import { ref, type Ref } from 'vue';
import { FEED_FILTER_KEY } from '../constants.ts';
import type { FeedFilter } from '../types.ts';
import { NO_FILTER, parseFeedFilter } from '../utils/feed.ts';

function read(): FeedFilter {
  try {
    return parseFeedFilter(localStorage.getItem(FEED_FILTER_KEY));
  } catch {
    return { ...NO_FILTER };
  }
}

/** The feed's filter, remembered on this computer across visits and months (a convenience). */
export function useFeedFilter(): { filter: Readonly<Ref<FeedFilter>>; set: (f: Partial<FeedFilter>) => void; reset: () => void } {
  const filter = ref<FeedFilter>(read());
  function set(f: Partial<FeedFilter>): void {
    filter.value = { ...filter.value, ...f };
    try {
      localStorage.setItem(FEED_FILTER_KEY, JSON.stringify(filter.value));
    } catch {
      // Storage unavailable: the choice holds for this visit.
    }
  }
  return { filter, set, reset: () => set(NO_FILTER) };
}

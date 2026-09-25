import type { Component } from "vue";

import LucideCircleCheckBig from "~icons/lucide/circle-check-big";
import LucideChevronLeft from "~icons/lucide/chevron-left";
import LucideChevronRight from "~icons/lucide/chevron-right";
import LucideCircleAlert from "~icons/lucide/circle-alert";
import LucideDownload from "~icons/lucide/download";
import LucideInfo from "~icons/lucide/info";
import LucideLoaderCircle from "~icons/lucide/loader-circle";
import LucidePlug from "~icons/lucide/plug";
import LucideRefreshCw from "~icons/lucide/refresh-cw";
import LucideSettings from "~icons/lucide/settings";
import LucideSparkles from "~icons/lucide/sparkles";
import LucideSquare from "~icons/lucide/square";
import LucideTrash from "~icons/lucide/trash";
import LucideTriangleAlert from "~icons/lucide/triangle-alert";

/**
 * Every icon the app can show, compiled into the bundle at build time by unplugin-icons
 * from the local @iconify-json/lucide set — nothing is fetched at runtime (the prod CSP has
 * connect-src 'none'). Static imports, not defineAsyncComponent: the icons are local anyway,
 * and async ones would flash empty on first paint.
 *
 * To add an icon: import it here and add its "lucide:<name>" key (the canonical Lucide name, not an alias). tests/ui.test.ts fails if
 * a component uses a name that is missing from this map.
 */
export const ICONS: Record<string, Component> = {
  // Lucide renamed check-circle; the key keeps the name VProgressBar (copied as is) uses.
  "lucide:check-circle": LucideCircleCheckBig,
  "lucide:chevron-left": LucideChevronLeft,
  "lucide:chevron-right": LucideChevronRight,
  "lucide:circle-alert": LucideCircleAlert,
  "lucide:download": LucideDownload,
  "lucide:info": LucideInfo,
  "lucide:loader-circle": LucideLoaderCircle,
  "lucide:plug": LucidePlug,
  "lucide:refresh-cw": LucideRefreshCw,
  "lucide:settings": LucideSettings,
  "lucide:sparkles": LucideSparkles,
  "lucide:square": LucideSquare,
  "lucide:trash": LucideTrash,
  "lucide:triangle-alert": LucideTriangleAlert,
};

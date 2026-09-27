import type { Component } from "vue";

import LucideChevronLeft from "~icons/lucide/chevron-left";
import LucideChevronRight from "~icons/lucide/chevron-right";
import LucideCircleAlert from "~icons/lucide/circle-alert";
import LucideCircleCheckBig from "~icons/lucide/circle-check-big";
import LucideDatabase from "~icons/lucide/database";
import LucideDownload from "~icons/lucide/download";
import LucideGlobe from "~icons/lucide/globe";
import LucideInfo from "~icons/lucide/info";
import LucideKeyRound from "~icons/lucide/key-round";
import LucideLandmark from "~icons/lucide/landmark";
import LucideLanguages from "~icons/lucide/languages";
import LucideLoaderCircle from "~icons/lucide/loader-circle";
import LucideMonitor from "~icons/lucide/monitor";
import LucideMoon from "~icons/lucide/moon";
import LucidePalette from "~icons/lucide/palette";
import LucidePlug from "~icons/lucide/plug";
import LucidePlus from "~icons/lucide/plus";
import LucideRefreshCw from "~icons/lucide/refresh-cw";
import LucideSettings from "~icons/lucide/settings";
import LucideShieldCheck from "~icons/lucide/shield-check";
import LucideSparkles from "~icons/lucide/sparkles";
import LucideSquare from "~icons/lucide/square";
import LucideSun from "~icons/lucide/sun";
import LucideTrash from "~icons/lucide/trash";
import LucideTriangleAlert from "~icons/lucide/triangle-alert";
import LucideUsers from "~icons/lucide/users";
import LucideWallet from "~icons/lucide/wallet";

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
  "lucide:database": LucideDatabase,
  "lucide:download": LucideDownload,
  "lucide:globe": LucideGlobe,
  "lucide:info": LucideInfo,
  "lucide:key-round": LucideKeyRound,
  "lucide:landmark": LucideLandmark,
  "lucide:languages": LucideLanguages,
  "lucide:loader-circle": LucideLoaderCircle,
  "lucide:monitor": LucideMonitor,
  "lucide:moon": LucideMoon,
  "lucide:palette": LucidePalette,
  "lucide:plug": LucidePlug,
  "lucide:plus": LucidePlus,
  "lucide:refresh-cw": LucideRefreshCw,
  "lucide:settings": LucideSettings,
  "lucide:shield-check": LucideShieldCheck,
  "lucide:sparkles": LucideSparkles,
  "lucide:square": LucideSquare,
  "lucide:sun": LucideSun,
  "lucide:trash": LucideTrash,
  "lucide:triangle-alert": LucideTriangleAlert,
  "lucide:users": LucideUsers,
  "lucide:wallet": LucideWallet,
};

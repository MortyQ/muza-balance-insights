import type { Component } from "vue";

import LucideCalendar from "~icons/lucide/calendar";
import LucideCheck from "~icons/lucide/check";
import LucideChevronDown from "~icons/lucide/chevron-down";
import LucideChevronLeft from "~icons/lucide/chevron-left";
import LucideChevronRight from "~icons/lucide/chevron-right";
import LucideChevronUp from "~icons/lucide/chevron-up";
import LucideCircleAlert from "~icons/lucide/circle-alert";
import LucideCircleCheckBig from "~icons/lucide/circle-check-big";
import LucideCopy from "~icons/lucide/copy";
import LucideDatabase from "~icons/lucide/database";
import LucideDownload from "~icons/lucide/download";
import LucideEye from "~icons/lucide/eye";
import LucideEyeOff from "~icons/lucide/eye-off";
import LucideFingerprintPattern from "~icons/lucide/fingerprint-pattern";
import LucideGlobe from "~icons/lucide/globe";
import LucideInfo from "~icons/lucide/info";
import LucideKeyRound from "~icons/lucide/key-round";
import LucideLandmark from "~icons/lucide/landmark";
import LucideLanguages from "~icons/lucide/languages";
import LucideLoaderCircle from "~icons/lucide/loader-circle";
import LucideLock from "~icons/lucide/lock";
import LucideMonitor from "~icons/lucide/monitor";
import LucideMoon from "~icons/lucide/moon";
import LucidePalette from "~icons/lucide/palette";
import LucidePenLine from "~icons/lucide/pen-line";
import LucidePlug from "~icons/lucide/plug";
import LucidePlus from "~icons/lucide/plus";
import LucideRefreshCcw from "~icons/lucide/refresh-ccw";
import LucideRefreshCw from "~icons/lucide/refresh-cw";
import LucideSearch from "~icons/lucide/search";
import LucideSend from "~icons/lucide/send";
import LucideSettings from "~icons/lucide/settings";
import LucideShieldCheck from "~icons/lucide/shield-check";
import LucideSparkles from "~icons/lucide/sparkles";
import LucideSquare from "~icons/lucide/square";
import LucideSun from "~icons/lucide/sun";
import LucideTrash from "~icons/lucide/trash";
import LucideTriangleAlert from "~icons/lucide/triangle-alert";
import LucideUsers from "~icons/lucide/users";
import LucideWallet from "~icons/lucide/wallet";
import LucideX from "~icons/lucide/x";

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
  "lucide:calendar": LucideCalendar,
  "lucide:check": LucideCheck,
  // Lucide renamed check-circle; the key keeps the name VProgressBar (copied as is) uses.
  "lucide:check-circle": LucideCircleCheckBig,
  "lucide:chevron-down": LucideChevronDown,
  "lucide:chevron-left": LucideChevronLeft,
  "lucide:chevron-right": LucideChevronRight,
  "lucide:chevron-up": LucideChevronUp,
  "lucide:circle-alert": LucideCircleAlert,
  "lucide:copy": LucideCopy,
  "lucide:database": LucideDatabase,
  "lucide:download": LucideDownload,
  "lucide:eye": LucideEye,
  "lucide:eye-off": LucideEyeOff,
  "lucide:fingerprint-pattern": LucideFingerprintPattern,
  "lucide:globe": LucideGlobe,
  "lucide:info": LucideInfo,
  "lucide:key-round": LucideKeyRound,
  "lucide:landmark": LucideLandmark,
  "lucide:languages": LucideLanguages,
  "lucide:loader-circle": LucideLoaderCircle,
  "lucide:lock": LucideLock,
  "lucide:monitor": LucideMonitor,
  "lucide:moon": LucideMoon,
  "lucide:palette": LucidePalette,
  "lucide:pen-line": LucidePenLine,
  "lucide:plug": LucidePlug,
  "lucide:plus": LucidePlus,
  "lucide:refresh-ccw": LucideRefreshCcw,
  "lucide:refresh-cw": LucideRefreshCw,
  "lucide:search": LucideSearch,
  "lucide:send": LucideSend,
  "lucide:settings": LucideSettings,
  "lucide:shield-check": LucideShieldCheck,
  "lucide:sparkles": LucideSparkles,
  "lucide:square": LucideSquare,
  "lucide:sun": LucideSun,
  "lucide:trash": LucideTrash,
  "lucide:triangle-alert": LucideTriangleAlert,
  "lucide:users": LucideUsers,
  "lucide:wallet": LucideWallet,
  "lucide:x": LucideX,
};

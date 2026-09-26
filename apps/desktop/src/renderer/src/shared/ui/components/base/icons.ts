import type { Component } from "vue";

import LucideCheck from "~icons/lucide/check";
import LucideCircleCheckBig from "~icons/lucide/circle-check-big";
import LucideCalendar from "~icons/lucide/calendar";
import LucideChevronDown from "~icons/lucide/chevron-down";
import LucideChevronLeft from "~icons/lucide/chevron-left";
import LucideChevronRight from "~icons/lucide/chevron-right";
import LucideChevronUp from "~icons/lucide/chevron-up";
import LucideCircleAlert from "~icons/lucide/circle-alert";
import LucideCopy from "~icons/lucide/copy";
import LucideDownload from "~icons/lucide/download";
import LucideEye from "~icons/lucide/eye";
import LucideEyeOff from "~icons/lucide/eye-off";
import LucideFingerprintPattern from "~icons/lucide/fingerprint-pattern";
import LucideInfo from "~icons/lucide/info";
import LucideLoaderCircle from "~icons/lucide/loader-circle";
import LucideLock from "~icons/lucide/lock";
import LucidePenLine from "~icons/lucide/pen-line";
import LucidePlug from "~icons/lucide/plug";
import LucideRefreshCw from "~icons/lucide/refresh-cw";
import LucideSearch from "~icons/lucide/search";
import LucideSend from "~icons/lucide/send";
import LucideSettings from "~icons/lucide/settings";
import LucideSparkles from "~icons/lucide/sparkles";
import LucideSquare from "~icons/lucide/square";
import LucideTrash from "~icons/lucide/trash";
import LucideTriangleAlert from "~icons/lucide/triangle-alert";
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
  "lucide:download": LucideDownload,
  "lucide:eye": LucideEye,
  "lucide:eye-off": LucideEyeOff,
  "lucide:fingerprint-pattern": LucideFingerprintPattern,
  "lucide:info": LucideInfo,
  "lucide:loader-circle": LucideLoaderCircle,
  "lucide:lock": LucideLock,
  "lucide:pen-line": LucidePenLine,
  "lucide:plug": LucidePlug,
  "lucide:refresh-cw": LucideRefreshCw,
  "lucide:search": LucideSearch,
  "lucide:send": LucideSend,
  "lucide:settings": LucideSettings,
  "lucide:sparkles": LucideSparkles,
  "lucide:square": LucideSquare,
  "lucide:trash": LucideTrash,
  "lucide:triangle-alert": LucideTriangleAlert,
  "lucide:x": LucideX,
};

import type { Component } from "vue";

import LucideArrowDownRight from "~icons/lucide/arrow-down-right";
import LucideArrowLeftRight from "~icons/lucide/arrow-left-right";
import LucideArrowUpRight from "~icons/lucide/arrow-up-right";
import LucideBanknote from "~icons/lucide/banknote";
import LucideBus from "~icons/lucide/bus";
import LucideCalendar from "~icons/lucide/calendar";
import LucideCalendarRange from "~icons/lucide/calendar-range";
import LucideChartColumn from "~icons/lucide/chart-column";
import LucideCheck from "~icons/lucide/check";
import LucideChevronDown from "~icons/lucide/chevron-down";
import LucideChevronLeft from "~icons/lucide/chevron-left";
import LucideChevronRight from "~icons/lucide/chevron-right";
import LucideChevronUp from "~icons/lucide/chevron-up";
import LucideCircleAlert from "~icons/lucide/circle-alert";
import LucideCircleCheckBig from "~icons/lucide/circle-check-big";
import LucideCircleEllipsis from "~icons/lucide/circle-ellipsis";
import LucideClapperboard from "~icons/lucide/clapperboard";
import LucideClock from "~icons/lucide/clock";
import LucideCoffee from "~icons/lucide/coffee";
import LucideCopy from "~icons/lucide/copy";
import LucideCreditCard from "~icons/lucide/credit-card";
import LucideDatabase from "~icons/lucide/database";
import LucideDownload from "~icons/lucide/download";
import LucideDumbbell from "~icons/lucide/dumbbell";
import LucideEye from "~icons/lucide/eye";
import LucideEyeOff from "~icons/lucide/eye-off";
import LucideFingerprintPattern from "~icons/lucide/fingerprint-pattern";
import LucideGift from "~icons/lucide/gift";
import LucideGlobe from "~icons/lucide/globe";
import LucideGraduationCap from "~icons/lucide/graduation-cap";
import LucideHandHeart from "~icons/lucide/hand-heart";
import LucideHeartPulse from "~icons/lucide/heart-pulse";
import LucideInfo from "~icons/lucide/info";
import LucideKeyRound from "~icons/lucide/key-round";
import LucideLandmark from "~icons/lucide/landmark";
import LucideLanguages from "~icons/lucide/languages";
import LucideLayoutDashboard from "~icons/lucide/layout-dashboard";
import LucideList from "~icons/lucide/list";
import LucideLoaderCircle from "~icons/lucide/loader-circle";
import LucideLock from "~icons/lucide/lock";
import LucideMaximize2 from "~icons/lucide/maximize-2";
import LucideMonitor from "~icons/lucide/monitor";
import LucideMoon from "~icons/lucide/moon";
import LucidePackage from "~icons/lucide/package";
import LucidePalette from "~icons/lucide/palette";
import LucidePawPrint from "~icons/lucide/paw-print";
import LucidePenLine from "~icons/lucide/pen-line";
import LucidePercent from "~icons/lucide/percent";
import LucidePlane from "~icons/lucide/plane";
import LucidePlug from "~icons/lucide/plug";
import LucidePlus from "~icons/lucide/plus";
import LucideRefreshCcw from "~icons/lucide/refresh-ccw";
import LucideRefreshCw from "~icons/lucide/refresh-cw";
import LucideSearch from "~icons/lucide/search";
import LucideSend from "~icons/lucide/send";
import LucideSettings from "~icons/lucide/settings";
import LucideShieldCheck from "~icons/lucide/shield-check";
import LucideShirt from "~icons/lucide/shirt";
import LucideShoppingCart from "~icons/lucide/shopping-cart";
import LucideSmartphone from "~icons/lucide/smartphone";
import LucideSofa from "~icons/lucide/sofa";
import LucideSparkles from "~icons/lucide/sparkles";
import LucideSquare from "~icons/lucide/square";
import LucideSun from "~icons/lucide/sun";
import LucideTrash from "~icons/lucide/trash";
import LucideTriangleAlert from "~icons/lucide/triangle-alert";
import LucideTruck from "~icons/lucide/truck";
import LucideUsers from "~icons/lucide/users";
import LucideWallet from "~icons/lucide/wallet";
import LucideX from "~icons/lucide/x";
import LucideZap from "~icons/lucide/zap";

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
  "lucide:arrow-down-right": LucideArrowDownRight,
  "lucide:arrow-left-right": LucideArrowLeftRight,
  "lucide:arrow-up-right": LucideArrowUpRight,
  "lucide:banknote": LucideBanknote,
  "lucide:bus": LucideBus,
  "lucide:calendar": LucideCalendar,
  "lucide:calendar-range": LucideCalendarRange,
  "lucide:chart-column": LucideChartColumn,
  "lucide:check": LucideCheck,
  // Lucide renamed check-circle; the key keeps the name VProgressBar (copied as is) uses.
  "lucide:check-circle": LucideCircleCheckBig,
  "lucide:chevron-down": LucideChevronDown,
  "lucide:chevron-left": LucideChevronLeft,
  "lucide:chevron-right": LucideChevronRight,
  "lucide:chevron-up": LucideChevronUp,
  "lucide:circle-alert": LucideCircleAlert,
  "lucide:circle-ellipsis": LucideCircleEllipsis,
  "lucide:clapperboard": LucideClapperboard,
  "lucide:clock": LucideClock,
  "lucide:coffee": LucideCoffee,
  "lucide:copy": LucideCopy,
  "lucide:credit-card": LucideCreditCard,
  "lucide:database": LucideDatabase,
  "lucide:download": LucideDownload,
  "lucide:dumbbell": LucideDumbbell,
  "lucide:eye": LucideEye,
  "lucide:eye-off": LucideEyeOff,
  "lucide:fingerprint-pattern": LucideFingerprintPattern,
  "lucide:gift": LucideGift,
  "lucide:globe": LucideGlobe,
  "lucide:graduation-cap": LucideGraduationCap,
  "lucide:hand-heart": LucideHandHeart,
  "lucide:heart-pulse": LucideHeartPulse,
  "lucide:info": LucideInfo,
  "lucide:key-round": LucideKeyRound,
  "lucide:landmark": LucideLandmark,
  "lucide:languages": LucideLanguages,
  "lucide:layout-dashboard": LucideLayoutDashboard,
  "lucide:list": LucideList,
  "lucide:loader-circle": LucideLoaderCircle,
  "lucide:lock": LucideLock,
  "lucide:maximize-2": LucideMaximize2,
  "lucide:monitor": LucideMonitor,
  "lucide:moon": LucideMoon,
  "lucide:package": LucidePackage,
  "lucide:palette": LucidePalette,
  "lucide:paw-print": LucidePawPrint,
  "lucide:pen-line": LucidePenLine,
  "lucide:percent": LucidePercent,
  "lucide:plane": LucidePlane,
  "lucide:plug": LucidePlug,
  "lucide:plus": LucidePlus,
  "lucide:refresh-ccw": LucideRefreshCcw,
  "lucide:refresh-cw": LucideRefreshCw,
  "lucide:search": LucideSearch,
  "lucide:send": LucideSend,
  "lucide:settings": LucideSettings,
  "lucide:shield-check": LucideShieldCheck,
  "lucide:shirt": LucideShirt,
  "lucide:shopping-cart": LucideShoppingCart,
  "lucide:smartphone": LucideSmartphone,
  "lucide:sofa": LucideSofa,
  "lucide:sparkles": LucideSparkles,
  "lucide:square": LucideSquare,
  "lucide:sun": LucideSun,
  "lucide:trash": LucideTrash,
  "lucide:triangle-alert": LucideTriangleAlert,
  "lucide:truck": LucideTruck,
  "lucide:users": LucideUsers,
  "lucide:wallet": LucideWallet,
  "lucide:x": LucideX,
  "lucide:zap": LucideZap,
};

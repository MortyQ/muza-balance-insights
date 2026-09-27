// BrowserWindow options (Security Checklist #2–4, #6, #8–10, #20). One place, tested as data.
import { TITLE_BAR_HEIGHT } from '../shared/titlebar.ts';

// theme.css --background / --foreground as hex: the native buttons (Windows, Linux) sit on our strip.
const OVERLAY_COLORS = {
  light: { color: '#eff1fc', symbolColor: '#0c0d14' },
  dark: { color: '#090d18', symbolColor: '#e7e7ec' },
} as const;

export function titleBarOverlay(dark: boolean) {
  return { ...OVERLAY_COLORS[dark ? 'dark' : 'light'], height: TITLE_BAR_HEIGHT };
}

// No system frame: the renderer draws the title bar (widgets/app-header). macOS keeps its traffic lights,
// Windows and Linux get native buttons over the strip; Linux also hides the menu bar (the menu and its shortcuts stay).
function frameOptions(platform: NodeJS.Platform, dark: boolean) {
  if (platform === 'darwin') return { titleBarStyle: 'hidden', trafficLightPosition: { x: 14, y: (TITLE_BAR_HEIGHT - 12) / 2 } } as const;
  const overlay = { titleBarStyle: 'hidden', titleBarOverlay: titleBarOverlay(dark) } as const;
  return platform === 'win32' ? overlay : { ...overlay, autoHideMenuBar: true };
}

export function windowOptions(opts: { preloadPath: string; isPackaged: boolean; title: string; platform: NodeJS.Platform; dark: boolean }) {
  return {
    width: 1100,
    height: 800,
    title: opts.title,
    show: false,
    ...frameOptions(opts.platform, opts.dark),
    webPreferences: {
      preload: opts.preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: false,
      devTools: !opts.isPackaged,
    },
  } as const;
}

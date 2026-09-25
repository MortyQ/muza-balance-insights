// BrowserWindow options (Security Checklist #2–4, #6, #8–10, #20). One place, tested as data.

export function windowOptions(opts: { preloadPath: string; isPackaged: boolean; title: string }) {
  return {
    width: 1100,
    height: 800,
    title: opts.title,
    show: false,
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

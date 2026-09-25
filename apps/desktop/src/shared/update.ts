// The app-update state as the renderer sees it. Plain types only (shared by main, the preload and the renderer).

/** auto: Windows and a Linux AppImage install by themselves; manual: macOS (and Linux without $APPIMAGE) get the file. */
export type UpdateMode = 'auto' | 'manual';

export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'up-to-date'; checkedAt: string }
  | { phase: 'available'; version: string; mode: UpdateMode }
  | { phase: 'downloading'; version: string; mode: UpdateMode; percent: number }
  /** auto: downloaded and verified; installs on «Перезапустить» or on the next quit. */
  | { phase: 'ready'; version: string }
  /** manual: downloaded, verified and saved to the Downloads folder under `fileName`. */
  | { phase: 'saved'; version: string; fileName: string }
  | { phase: 'error'; message: string };

export type UpdateView = {
  currentVersion: string;
  /** «Проверять обновления» in settings (on by default). */
  checksEnabled: boolean;
  /** false in a dev build: nothing is checked. */
  supported: boolean;
  state: UpdateState;
};

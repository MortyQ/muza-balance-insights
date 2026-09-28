// The app-update state as the renderer sees it. Plain types only (shared by main, the preload and the renderer).

/** auto: Windows and a Linux AppImage install by themselves; manual: macOS (and Linux without $APPIMAGE) get the file. */
export type UpdateMode = 'auto' | 'manual';

/** Why a check or a download failed; the renderer words it (`settings.update.error.*`). */
export type UpdateError = 'offline' | 'rejected' | 'download' | 'mismatch';

export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'up-to-date'; checkedAt: string }
  | { phase: 'available'; version: string; mode: UpdateMode }
  | { phase: 'downloading'; version: string; mode: UpdateMode; percent: number }
  /** auto: downloaded and verified; installs on «Restart and update» or on the next quit. */
  | { phase: 'ready'; version: string }
  /** manual: downloaded, verified and saved to the Downloads folder under `fileName`. */
  | { phase: 'saved'; version: string; fileName: string }
  | { phase: 'error'; reason: UpdateError };

export type UpdateView = {
  currentVersion: string;
  /** «Check automatically» in settings (on by default). */
  checksEnabled: boolean;
  /** false in a dev build: nothing is checked. */
  supported: boolean;
  state: UpdateState;
};

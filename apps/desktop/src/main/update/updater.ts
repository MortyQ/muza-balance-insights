// App updates. A new version is offered only through the signed manifest (manifest.ts); what is installed must match
// its size and sha512. Windows and a Linux AppImage download in the background with electron-updater and install on
// «Перезапустить» or on the next quit; macOS (and Linux without $APPIMAGE) get the verified file in Downloads.
// Everything the class touches comes in through UpdaterDeps, so the whole flow is tested without Electron.
import path from 'node:path';
import type { UpdateMode, UpdateState, UpdateView } from '../../shared/update.ts';
import { UpdateRejected, fileMatches, pickFile, verifyManifest, type Manifest, type ManifestFile } from './manifest.ts';

export const REPO = { owner: 'MortyQ', repo: 'muza-balance-insights' } as const;
const RELEASES = `https://github.com/${REPO.owner}/${REPO.repo}/releases`;
export const MANIFEST_URL = `${RELEASES}/latest/download/update.json`;
export const SIGNATURE_URL = `${RELEASES}/latest/download/update.json.sig`;
export const fileUrl = (version: string, name: string) => `${RELEASES}/download/v${version}/${encodeURIComponent(name)}`;

export const FIRST_CHECK_DELAY_MS = 10_000;
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
export const FETCH_TIMEOUT_MS = 10_000;

/** The part of electron-updater's AppUpdater this class uses. */
export interface ElectronUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  allowDowngrade: boolean;
  disableDifferentialDownload: boolean;
  setFeedURL(options: { provider: 'github'; owner: string; repo: string }): void;
  checkForUpdates(): Promise<{ updateInfo: { version: string } } | null>;
  downloadUpdate(): Promise<string[]>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: 'download-progress', cb: (p: { percent: number }) => void): unknown;
}

export interface UpdaterDeps {
  currentVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  /** false in dev: nothing is checked. */
  isPackaged: boolean;
  /** $APPIMAGE: set when the app runs as an AppImage (electron-updater replaces that file). */
  appImage: string | undefined;
  publicKeyPem: string;
  checksEnabled: boolean;
  saveChecksEnabled(enabled: boolean): Promise<void>;
  /** Where a manual download is saved (the user's Downloads folder). */
  downloadsDir: string;
  /** Scratch space for a download in progress (userData/updates). */
  updatesDir: string;
  fetchBytes(url: string): Promise<Uint8Array>;
  /** Streams url → dest; `maxBytes` caps it. */
  download(url: string, dest: string, maxBytes: number, onProgress: (percent: number) => void): Promise<void>;
  /** electron-updater's autoUpdater, created on first use (never on macOS). */
  electronUpdater(): ElectronUpdaterLike;
  importRunning(): boolean;
  /** Moves a verified file to a free name in `dir`; returns the name used. */
  moveToFreeName(from: string, dir: string, name: string): Promise<string>;
  remove(file: string): Promise<void>;
  send(view: UpdateView): void;
  log(message: string): void;
  now(): Date;
}

const TEXT = {
  offline: 'Не удалось проверить обновления: нет связи с GitHub. Попробуй позже.',
  rejected: 'Обновление не прошло проверку подписи и не будет установлено.',
  download: 'Не удалось скачать обновление. Попробуй позже.',
  mismatch: 'Скачанный файл обновления не совпал с подписанным описанием — он удалён и не будет установлен.',
} as const;

export class Updater {
  private state: UpdateState = { phase: 'idle' };
  private manifest: { m: Manifest; file: ManifestFile } | null = null;
  private busy = false;
  private eu: ElectronUpdaterLike | null = null;
  private checksEnabled: boolean;

  constructor(private readonly d: UpdaterDeps) {
    this.checksEnabled = d.checksEnabled;
  }

  get supported(): boolean {
    return this.d.isPackaged;
  }

  get mode(): UpdateMode {
    if (this.d.platform === 'win32') return 'auto';
    if (this.d.platform === 'linux' && this.d.appImage) return 'auto';
    return 'manual';
  }

  view(): UpdateView {
    return { currentVersion: this.d.currentVersion, checksEnabled: this.checksEnabled, supported: this.supported, state: this.state };
  }

  /** Background checks (the scheduler) do nothing when they are off; a check the user asked for always runs. */
  async check(userAsked: boolean): Promise<UpdateView> {
    if (!this.supported || this.busy) return this.view();
    if (!userAsked && !this.checksEnabled) return this.view();
    if (['downloading', 'ready', 'saved'].includes(this.state.phase)) return this.view();
    this.busy = true;
    const before = this.state;
    this.set({ phase: 'checking' });
    try {
      const [bytes, sig] = await Promise.all([this.d.fetchBytes(MANIFEST_URL), this.d.fetchBytes(SIGNATURE_URL)]);
      const m = verifyManifest(bytes, Buffer.from(sig).toString('utf8'), this.d.publicKeyPem, this.d.currentVersion);
      const file = pickFile(m, this.d.platform, this.d.arch);
      if (!file) {
        this.set({ phase: 'up-to-date', checkedAt: this.d.now().toISOString() });
        return this.view();
      }
      this.manifest = { m, file };
      this.set({ phase: 'available', version: m.version, mode: this.mode });
    } catch (e) {
      if (e instanceof UpdateRejected && e.code === 'not-newer') {
        this.set({ phase: 'up-to-date', checkedAt: this.d.now().toISOString() });
      } else if (e instanceof UpdateRejected) {
        this.d.log(`update check: ${e.code}`);
        this.set({ phase: 'error', message: TEXT.rejected });
      } else {
        this.d.log(`update check failed: ${e instanceof Error ? e.name : 'error'}`);
        // A background check that could not reach GitHub leaves the screen as it was.
        this.set(userAsked ? { phase: 'error', message: TEXT.offline } : before);
      }
      return this.view();
    } finally {
      this.busy = false;
    }
    if (this.mode === 'auto') await this.download();
    return this.view();
  }

  /** auto: electron-updater downloads, we verify; manual: we download, verify and save to Downloads. */
  async download(): Promise<UpdateView> {
    if (!this.manifest || this.state.phase !== 'available' || this.busy) return this.view();
    this.busy = true;
    const { m, file } = this.manifest;
    const mode = this.mode;
    this.set({ phase: 'downloading', version: m.version, mode, percent: 0 });
    try {
      if (mode === 'auto') await this.downloadAuto(m, file);
      else await this.downloadManual(m, file);
    } catch (e) {
      this.d.log(`update download failed: ${e instanceof Error ? e.name : 'error'}`);
      this.set({ phase: 'error', message: TEXT.download });
    } finally {
      this.busy = false;
    }
    return this.view();
  }

  private async downloadAuto(m: Manifest, file: ManifestFile): Promise<void> {
    const eu = this.updater();
    const found = await eu.checkForUpdates();
    // electron-updater reads latest.yml of the same release; it must describe the version we verified.
    if (found?.updateInfo.version !== m.version) {
      this.d.log('update: latest.yml version differs from the signed manifest');
      this.set({ phase: 'error', message: TEXT.rejected });
      return;
    }
    const [downloaded] = await eu.downloadUpdate();
    if (!downloaded || !(await fileMatches(downloaded, file))) {
      if (downloaded) await this.d.remove(downloaded);
      this.set({ phase: 'error', message: TEXT.mismatch });
      return;
    }
    // Only now: electron-updater installs on the next quit, and only this verified file.
    eu.autoInstallOnAppQuit = true;
    this.set({ phase: 'ready', version: m.version });
  }

  private async downloadManual(m: Manifest, file: ManifestFile): Promise<void> {
    const part = path.join(this.d.updatesDir, `${file.name}.part`);
    await this.d.download(fileUrl(m.version, file.name), part, file.size, (percent) =>
      this.set({ phase: 'downloading', version: m.version, mode: 'manual', percent }),
    );
    if (!(await fileMatches(part, file))) {
      await this.d.remove(part);
      this.set({ phase: 'error', message: TEXT.mismatch });
      return;
    }
    const fileName = await this.d.moveToFreeName(part, this.d.downloadsDir, file.name);
    this.set({ phase: 'saved', version: m.version, fileName });
  }

  /** auto mode, `ready` only; never during an import (it resumes after the restart anyway, but a window is lost). */
  install(): { started: boolean; reason?: 'import-running' | 'not-ready' } {
    if (this.state.phase !== 'ready' || !this.eu) return { started: false, reason: 'not-ready' };
    if (this.d.importRunning()) return { started: false, reason: 'import-running' };
    this.eu.quitAndInstall(true, true);
    return { started: true };
  }

  async setChecks(enabled: boolean): Promise<UpdateView> {
    await this.d.saveChecksEnabled(enabled);
    this.checksEnabled = enabled;
    this.push();
    return this.view();
  }

  private updater(): ElectronUpdaterLike {
    if (this.eu) return this.eu;
    const eu = this.d.electronUpdater();
    eu.autoDownload = false;
    eu.autoInstallOnAppQuit = false;
    eu.allowPrerelease = false;
    eu.allowDowngrade = false;
    // The release carries no .blockmap files: always the whole installer.
    eu.disableDifferentialDownload = true;
    eu.setFeedURL({ provider: 'github', owner: REPO.owner, repo: REPO.repo });
    eu.on('download-progress', (p) => {
      if (this.state.phase === 'downloading') this.set({ ...this.state, percent: Math.round(p.percent) });
    });
    this.eu = eu;
    return eu;
  }

  private set(state: UpdateState): void {
    this.state = state;
    this.push();
  }

  private push(): void {
    this.d.send(this.view());
  }
}

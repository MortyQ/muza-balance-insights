// Wires the Updater to Electron: the guarded session, electron-updater (Windows, Linux AppImage), files and the
// schedule. The only file of the updater that imports electron / electron-updater.
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { app, session } from 'electron';
import electronUpdater from 'electron-updater';
import type { UpdateView } from '../../shared/update.ts';
import { readPrefs, writePrefs } from './prefs.ts';
import { UPDATE_PUBLIC_KEY } from './public-key.ts';
import { UPDATE_PARTITION, downloadTo, fetchBytes, guardUpdateSession, type UpdateSessionLike } from './session.ts';
import { CHECK_EVERY_MS, FETCH_TIMEOUT_MS, FIRST_CHECK_DELAY_MS, Updater, type ElectronUpdaterLike } from './updater.ts';

export function createUpdater(opts: {
  userDataDir: string;
  importRunning: () => boolean;
  send: (view: UpdateView) => void;
  log: (message: string) => void;
}): Updater {
  // electron-updater creates the same partition on first use: the guard is on it before any request goes out.
  const ses: UpdateSessionLike = session.fromPartition(UPDATE_PARTITION, { cache: false });
  guardUpdateSession(ses, (host) => opts.log(`blocked request to ${host}`));
  const updatesDir = path.join(opts.userDataDir, 'updates');

  return new Updater({
    currentVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    appImage: process.env.APPIMAGE,
    publicKeyPem: UPDATE_PUBLIC_KEY,
    checksEnabled: readPrefs(opts.userDataDir).updateChecks,
    saveChecksEnabled: (enabled) => writePrefs(opts.userDataDir, { updateChecks: enabled }),
    downloadsDir: app.getPath('downloads'),
    updatesDir,
    fetchBytes: (url) => fetchBytes(ses, url, FETCH_TIMEOUT_MS),
    download: async (url, dest, maxBytes, onProgress) => {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await downloadTo(ses, url, dest, maxBytes, onProgress, (to, chunks) =>
        pipeline(Readable.from(chunks), fs.createWriteStream(to, { mode: 0o600 })),
      );
    },
    // A getter in electron-updater: the platform updater is created here, on first use, never on macOS.
    electronUpdater: (): ElectronUpdaterLike => electronUpdater.autoUpdater,
    importRunning: opts.importRunning,
    moveToFreeName,
    remove: (file) => fs.promises.rm(file, { force: true }),
    send: opts.send,
    log: opts.log,
    now: () => new Date(),
  });
}

/** Renames into `dir` as `name`, or «name (2).ext» … if taken; copies across volumes. */
async function moveToFreeName(from: string, dir: string, name: string): Promise<string> {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  for (let i = 1; i < 100; i++) {
    const candidate = i === 1 ? name : `${base} (${i})${ext}`;
    const to = path.join(dir, candidate);
    if (fs.existsSync(to)) continue;
    try {
      await fs.promises.rename(from, to);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
      await fs.promises.copyFile(from, to, fs.constants.COPYFILE_EXCL);
      await fs.promises.rm(from, { force: true });
    }
    return candidate;
  }
  throw new Error('no free file name in Downloads');
}

/** First check a little after start (never blocks the launch or an import), then every few hours. */
export function scheduleChecks(updater: Updater): () => void {
  const first = setTimeout(() => void updater.check(false), FIRST_CHECK_DELAY_MS);
  const every = setInterval(() => void updater.check(false), CHECK_EVERY_MS);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}

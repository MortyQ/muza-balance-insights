// Sandboxed preload (CommonJS, no npm modules): exposes window.balance — one function per method of the contract
// (openDroppedStatement / openDroppedUpload take Files and send their paths) plus onProgress, onUpdate, onOpenSettings, onLock and onDbState. Nothing from Electron itself is exposed (Security Checklist #20).
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { API_KEY, DB_STATE_CHANNEL, LOCK_CHANNEL, METHODS, OPEN_SETTINGS_CHANNEL, PROGRESS_CHANNEL, UPDATE_CHANNEL, channel } from '../shared/channels.ts';

const api: Record<string, unknown> = {};
for (const m of METHODS) api[m] = (...args: unknown[]) => ipcRenderer.invoke(channel(m), ...args);
// A dropped file reaches main as its path, which only the preload can read; the renderer passes the File itself and
// never sees the path. A File made by script has none (''), so main refuses it by its arguments.
api.openDroppedStatement = (file: unknown) => ipcRenderer.invoke(channel('openDroppedStatement'), webUtils.getPathForFile(file as File));
api.openDroppedUpload = (files: unknown) =>
  ipcRenderer.invoke(channel('openDroppedUpload'), Array.isArray(files) ? files.map((f) => webUtils.getPathForFile(f as File)) : []);

/** The callback receives the payload only — never the IpcRendererEvent (it carries `sender`). Returns an unsubscribe. */
function subscribe(ch: string, name: string) {
  return (cb: (payload: unknown) => void) => {
    if (typeof cb !== 'function') throw new TypeError(`${name}: expected a function`);
    const listener = (_event: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(ch, listener);
    return () => void ipcRenderer.removeListener(ch, listener);
  };
}
api.onProgress = subscribe(PROGRESS_CHANNEL, 'onProgress');
api.onUpdate = subscribe(UPDATE_CHANNEL, 'onUpdate');
api.onOpenSettings = subscribe(OPEN_SETTINGS_CHANNEL, 'onOpenSettings');
api.onLock = subscribe(LOCK_CHANNEL, 'onLock');
api.onDbState = subscribe(DB_STATE_CHANNEL, 'onDbState');

contextBridge.exposeInMainWorld(API_KEY, Object.freeze(api));

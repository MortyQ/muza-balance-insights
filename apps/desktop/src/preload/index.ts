// Sandboxed preload (CommonJS, no npm modules): exposes window.balance — one function per method of the contract
// plus onProgress, onUpdate and onOpenSettings. Nothing from Electron itself is exposed (Security Checklist #20).
import { contextBridge, ipcRenderer } from 'electron';
import { API_KEY, METHODS, OPEN_SETTINGS_CHANNEL, PROGRESS_CHANNEL, UPDATE_CHANNEL, channel } from '../shared/channels.ts';

const api: Record<string, unknown> = {};
for (const m of METHODS) api[m] = (...args: unknown[]) => ipcRenderer.invoke(channel(m), ...args);

/** The callback receives the payload only — never the IpcRendererEvent (it carries `sender`). Returns an unsubscribe. */
function subscribe(ch: string, name: string) {
  return (cb: (payload: unknown) => void) => {
    if (typeof cb !== 'function') throw new TypeError(`${name}: нужна функция`);
    const listener = (_event: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on(ch, listener);
    return () => void ipcRenderer.removeListener(ch, listener);
  };
}
api.onProgress = subscribe(PROGRESS_CHANNEL, 'onProgress');
api.onUpdate = subscribe(UPDATE_CHANNEL, 'onUpdate');
api.onOpenSettings = subscribe(OPEN_SETTINGS_CHANNEL, 'onOpenSettings');

contextBridge.exposeInMainWorld(API_KEY, Object.freeze(api));

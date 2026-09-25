// Sandboxed preload (CommonJS, no npm modules): exposes window.balance — one function per method of the contract
// plus onProgress. Nothing from Electron itself is exposed (Security Checklist #20).
import { contextBridge, ipcRenderer } from 'electron';
import { API_KEY, METHODS, PROGRESS_CHANNEL, channel } from '../shared/channels.ts';

const api: Record<string, unknown> = {};
for (const m of METHODS) api[m] = (...args: unknown[]) => ipcRenderer.invoke(channel(m), ...args);

/** The callback receives the payload only — never the IpcRendererEvent (it carries `sender`). Returns an unsubscribe. */
api.onProgress = (cb: (payload: unknown) => void) => {
  if (typeof cb !== 'function') throw new TypeError('onProgress: нужна функция');
  const listener = (_event: unknown, payload: unknown) => cb(payload);
  ipcRenderer.on(PROGRESS_CHANNEL, listener);
  return () => void ipcRenderer.removeListener(PROGRESS_CHANNEL, listener);
};

contextBridge.exposeInMainWorld(API_KEY, Object.freeze(api));

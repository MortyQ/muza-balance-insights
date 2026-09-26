// App name and userData location, fixed before `ready` (after it, Electron has already created the default folder).
// The paths are also closed to the agent in .claude/settings.json (Read/Edit deny + sandbox denyRead).
import fs from 'node:fs';
import path from 'node:path';

export const APP_NAME = 'Balance Insights';
export const DEV_APP_NAME = 'Balance Insights Dev';

type AppLike = {
  isPackaged: boolean;
  isReady(): boolean;
  getPath(name: 'appData'): string;
  setName(name: string): void;
  setPath(name: 'userData', value: string): void;
};

/** Dev and prod never share data: `pnpm dev` writes to «Balance Insights Dev». */
export function appIdentity(isPackaged: boolean, appDataDir: string): { name: string; userData: string } {
  const name = isPackaged ? APP_NAME : DEV_APP_NAME;
  return { name, userData: path.join(appDataDir, name) };
}

export function configureIdentity(app: AppLike): { name: string; userData: string } {
  if (app.isReady()) throw new Error('configureIdentity must run before app ready');
  const id = appIdentity(app.isPackaged, app.getPath('appData'));
  app.setName(id.name);
  app.setPath('userData', id.userData);
  return id;
}

/**
 * userData is closed to other local users: Electron creates it with the default mode (usually 0755), and the database,
 * its WAL and the job file inside get 0644. On Linux a readable home would expose them; the folder's 0700 closes
 * everything in it. Windows has no POSIX modes — the profile ACL does this there.
 */
export async function restrictUserData(dir: string, platform: NodeJS.Platform = process.platform): Promise<void> {
  if (platform === 'win32') return;
  await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
  await fs.promises.chmod(dir, 0o700);
}

// Checks of a built app, shared by package.test.ts (the unpacked app in dist/ on macOS, Windows, Linux) and
// dmg.test.ts (the app inside each .dmg). Read-only: nothing here starts the app.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FuseV1Options, getCurrentFuseWire } from '@electron/fuses';
import { expect } from 'vitest';

export const PRODUCT = 'Balance Insights';
export const APP_ID = 'io.github.mortyq.balanceinsights';
/** linux.executableName in electron-builder.json (the default would be the npm package name). */
export const LINUX_EXECUTABLE = 'balance-insights';

/** @electron/fuses 1.x declares FuseState in dist/constants but does not export it: the wire bytes are '0' / '1'. */
export const FuseState = { DISABLE: 48, ENABLE: 49 } as const;
type FuseState = (typeof FuseState)[keyof typeof FuseState];

/** The agreed table (reports/2026-09-24-stage1-electron-plan.md, «Fuses»). */
export const EXPECTED_FUSES: Array<[FuseV1Options, FuseState, string]> = [
  [FuseV1Options.RunAsNode, FuseState.DISABLE, 'ELECTRON_RUN_AS_NODE turns the app into plain Node'],
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseState.DISABLE, 'NODE_OPTIONS=--require would inject code into main'],
  [FuseV1Options.EnableNodeCliInspectArguments, FuseState.DISABLE, '--inspect would attach a debugger to main'],
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseState.ENABLE, 'app.asar hash checked at start (macOS, Windows)'],
  [FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE, 'code only from app.asar, not a side app/ folder'],
  [FuseV1Options.GrantFileProtocolExtraPrivileges, FuseState.DISABLE, 'file:// gets no extra rights (we use app://)'],
  [FuseV1Options.EnableCookieEncryption, FuseState.DISABLE, 'no cookies; Keychain is flaky unsigned'],
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, FuseState.DISABLE, 'no separate snapshot'],
];

export type Platform = 'darwin' | 'win32' | 'linux';

/** A built app: where its resources and main executable are. `dir` is what holds the .app (mac) or the unpacked app. */
export type Built = { platform: Platform; root: string; resources: string; binary: string; plist: string | null };

export function built(dir: string, platform: Platform): Built {
  if (platform === 'darwin') {
    const root = path.join(dir, `${PRODUCT}.app`);
    const contents = path.join(root, 'Contents');
    return { platform, root, resources: path.join(contents, 'Resources'), binary: path.join(contents, 'MacOS', PRODUCT), plist: path.join(contents, 'Info.plist') };
  }
  const exe = platform === 'win32' ? `${PRODUCT}.exe` : LINUX_EXECUTABLE;
  return { platform, root: dir, resources: path.join(dir, 'resources'), binary: path.join(dir, exe), plist: null };
}

/** The libsql native package each build must carry, by platform and arch (as `process.arch` names it). */
export function libsqlNative(platform: Platform, arch: string): string {
  if (platform === 'darwin') return `@libsql/darwin-${arch}`;
  if (platform === 'win32') return `@libsql/win32-${arch}-msvc`;
  return `@libsql/linux-${arch}-gnu`;
}

/** asar header: uint32 4, uint32 header size, uint32, uint32 JSON length, then the JSON directory tree. */
export function asarFiles(asarPath: string): string[] {
  const fd = fs.openSync(asarPath, 'r');
  try {
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    const json = Buffer.alloc(head.readUInt32LE(12));
    fs.readSync(fd, json, 0, json.length, 16);
    type Node = { files?: Record<string, Node> };
    const out: string[] = [];
    const walk = (n: Node, prefix: string) => {
      for (const [name, child] of Object.entries(n.files ?? {})) {
        const p = prefix ? `${prefix}/${name}` : name;
        if (child.files) walk(child, p);
        else out.push(p);
      }
    };
    walk(JSON.parse(json.toString('utf8')) as Node, '');
    return out;
  } finally {
    fs.closeSync(fd);
  }
}

export async function expectFuses(b: Built) {
  const wire = await getCurrentFuseWire(b.binary);
  for (const [fuse, state, why] of EXPECTED_FUSES) expect(wire[fuse], `${FuseV1Options[fuse]}: ${why}`).toBe(state);
}

/** Code only from app.asar: no side app/ folder. On macOS the asar hash is also in Info.plist. */
export function expectAsarOnly(b: Built) {
  expect(fs.existsSync(path.join(b.resources, 'app.asar'))).toBe(true);
  expect(fs.existsSync(path.join(b.resources, 'app'))).toBe(false);
  if (b.plist) expect(fs.readFileSync(b.plist, 'utf8')).toContain('ElectronAsarIntegrity');
}

export function expectBundleId(b: Built) {
  const escaped = APP_ID.replace(/\./g, '\\.');
  expect(fs.readFileSync(b.plist!, 'utf8')).toMatch(new RegExp(`<key>CFBundleIdentifier</key>\\s*<string>${escaped}</string>`));
}

export function expectAsarContents(b: Built) {
  const files = asarFiles(path.join(b.resources, 'app.asar'));
  for (const f of ['package.json', 'out/main/index.js', 'out/preload/index.cjs', 'out/renderer/index.html']) expect(files).toContain(f);
  expect(files.some((f) => f.startsWith('node_modules/@libsql/client/'))).toBe(true);
  expect(files.some((f) => f.startsWith('node_modules/zod/'))).toBe(true);
  const bad = files.filter(
    (f) =>
      /^(src|tests|scripts|build)\//.test(f) ||
      f.startsWith('node_modules/@mono/') ||
      /\.map$/.test(f) ||
      /(^|\/)\.env(\.|$)/.test(f) ||
      /\.db(-|$)/.test(f) ||
      /(^|\/)(electron-builder\.json|electron\.vite\.config\.ts|tsconfig[^/]*\.json)$/.test(f),
  );
  expect(bad).toEqual([]);
}

/** Unpacked native modules (they cannot load from inside the asar), with forward slashes on every OS. */
export function unpackedNatives(b: Built): string[] {
  const unpacked = path.join(b.resources, 'app.asar.unpacked');
  return fs.existsSync(unpacked)
    ? fs.readdirSync(unpacked, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.node')).map((f) => f.split(path.sep).join('/'))
    : [];
}

/** macOS: codesign only reads the bundle; it does not start the app. */
export function expectValidSignature(b: Built) {
  expect(() => execFileSync('codesign', ['--verify', '--deep', '--strict', b.root], { stdio: 'pipe' })).not.toThrow();
}

/** macOS: architectures of the main executable, as `lipo` names them (arm64, x86_64). */
export function binaryArchs(b: Built): string[] {
  return execFileSync('lipo', ['-archs', b.binary], { encoding: 'utf8' }).trim().split(/\s+/).sort();
}

/** macOS: our icon, not Electron's default — build/icon.icns is copied into Resources and named in Info.plist. */
export function expectOwnIcon(b: Built, iconIcns: string) {
  expect(fs.readFileSync(b.plist!, 'utf8')).toMatch(/<key>CFBundleIconFile<\/key>\s*<string>icon\.icns<\/string>/);
  expect(fs.readFileSync(path.join(b.resources, 'icon.icns')).equals(fs.readFileSync(iconIcns))).toBe(true);
}

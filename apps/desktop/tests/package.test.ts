// Security Checklist #19 (fuses) and the shape of the packaged app. The config part always runs; the binary part runs
// on the output of `pnpm --filter @mono/desktop package:dir` (dist/). `test:package` builds first and fails if dist/
// is missing (PACKAGE_CHECK=1), so a green run there really checked a binary. Nothing here launches the app.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FuseV1Options, getCurrentFuseWire } from '@electron/fuses';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, 'electron-builder.json'), 'utf8')) as Record<string, unknown>;
const PRODUCT = 'Balance Insights';

/** @electron/fuses 1.x declares FuseState in dist/constants but does not export it: the wire bytes are '0' / '1'. */
const FuseState = { DISABLE: 48, ENABLE: 49 } as const;
type FuseState = (typeof FuseState)[keyof typeof FuseState];

/** The agreed table (reports/2026-09-24-stage1-electron-plan.md, «Fuses»). */
const EXPECTED_FUSES: Array<[FuseV1Options, FuseState, string]> = [
  [FuseV1Options.RunAsNode, FuseState.DISABLE, 'ELECTRON_RUN_AS_NODE turns the app into plain Node'],
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseState.DISABLE, 'NODE_OPTIONS=--require would inject code into main'],
  [FuseV1Options.EnableNodeCliInspectArguments, FuseState.DISABLE, '--inspect would attach a debugger to main'],
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseState.ENABLE, 'app.asar hash checked at start'],
  [FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE, 'code only from app.asar, not a side app/ folder'],
  [FuseV1Options.GrantFileProtocolExtraPrivileges, FuseState.DISABLE, 'file:// gets no extra rights (we use app://)'],
  [FuseV1Options.EnableCookieEncryption, FuseState.DISABLE, 'no cookies; Keychain is flaky unsigned'],
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, FuseState.DISABLE, 'no separate snapshot'],
];

describe('electron-builder config', () => {
  it('fuses exactly as agreed, plus an ad-hoc re-sign (flipping fuses breaks the arm64 signature)', () => {
    expect(config.electronFuses).toEqual({
      runAsNode: false,
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false,
      enableEmbeddedAsarIntegrityValidation: true,
      onlyLoadAppFromAsar: true,
      grantFileProtocolExtraPrivileges: false,
      enableCookieEncryption: false,
      loadBrowserProcessSpecificV8Snapshot: false,
      resetAdHocDarwinSignature: true,
    });
  });

  it('only the build output goes in, as an asar; native modules unpacked; no rebuild, no download, no signing identity', () => {
    expect(config.productName).toBe(PRODUCT);
    expect(config.files).toEqual(['out/**', 'package.json']);
    expect(config.asar).toBe(true);
    expect(config.asarUnpack).toEqual(['**/*.node']);
    expect(config.npmRebuild).toBe(false);
    expect(config.electronDist).toBe('node_modules/electron/dist');
    expect(config.mac).toMatchObject({ target: 'dir', identity: null });
  });
});

// ---------- the built app ----------

function findApp(): string | null {
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(dist)) return null;
  for (const d of fs.readdirSync(dist)) {
    const app = path.join(dist, d, `${PRODUCT}.app`);
    if (fs.existsSync(app)) return app;
  }
  return null;
}

/** asar header: uint32 4, uint32 header size, uint32, uint32 JSON length, then the JSON directory tree. */
function asarFiles(asarPath: string): string[] {
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

const app = process.platform === 'darwin' ? findApp() : null;
if (process.env.PACKAGE_CHECK === '1' && !app) throw new Error('PACKAGE_CHECK=1 but no dist/*/Balance Insights.app: run package:dir first');

describe.skipIf(!app)('packaged app (dist/)', () => {
  const contents = path.join(app ?? '', 'Contents');
  const resources = path.join(contents, 'Resources');
  const binary = path.join(contents, 'MacOS', PRODUCT);

  it.each(EXPECTED_FUSES)('fuse %s is %s in the binary (%s)', async (fuse, state) => {
    const wire = await getCurrentFuseWire(binary);
    expect(wire[fuse]).toBe(state);
  });

  it('code only from app.asar: no side app/ folder; the asar hash is in Info.plist', () => {
    expect(fs.existsSync(path.join(resources, 'app.asar'))).toBe(true);
    expect(fs.existsSync(path.join(resources, 'app'))).toBe(false);
    expect(fs.readFileSync(path.join(contents, 'Info.plist'), 'utf8')).toContain('ElectronAsarIntegrity');
  });

  it('the asar holds the build output and runtime deps only — no sources, maps, tests, workspace packages or data', () => {
    const files = asarFiles(path.join(resources, 'app.asar'));
    for (const f of ['package.json', 'out/main/index.js', 'out/preload/index.cjs', 'out/renderer/index.html']) expect(files).toContain(f);
    expect(files.some((f) => f.startsWith('node_modules/@libsql/client/'))).toBe(true);
    expect(files.some((f) => f.startsWith('node_modules/zod/'))).toBe(true);
    const bad = files.filter(
      (f) =>
        /^(src|tests|scripts)\//.test(f) ||
        f.startsWith('node_modules/@mono/') ||
        /\.map$/.test(f) ||
        /(^|\/)\.env(\.|$)/.test(f) ||
        /\.db(-|$)/.test(f) ||
        /(^|\/)(electron-builder\.json|electron\.vite\.config\.ts|tsconfig[^/]*\.json)$/.test(f),
    );
    expect(bad).toEqual([]);
  });

  it('the native libsql module is unpacked next to the asar (it cannot load from inside)', () => {
    const unpacked = path.join(resources, 'app.asar.unpacked');
    const natives = fs.existsSync(unpacked) ? fs.readdirSync(unpacked, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.node')) : [];
    expect(natives.some((f) => f.includes('libsql'))).toBe(true);
  });

  it('the bundle is validly signed (ad-hoc) after the fuses were flipped — otherwise macOS on arm64 kills it', () => {
    // codesign only reads the bundle; it does not start the app.
    expect(() => execFileSync('codesign', ['--verify', '--deep', '--strict', app!], { stdio: 'pipe' })).not.toThrow();
  });
});

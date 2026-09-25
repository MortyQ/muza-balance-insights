// The signed update manifest (update.json + update.json.sig, written by scripts/update-sign.mjs in the release job).
// An update is offered only when the signature verifies with the key inside the app, the manifest is for this app,
// strictly newer, and lists a file for this OS and architecture. Every refusal is an UpdateRejected with a code.
import { createHash, createPublicKey, verify } from 'node:crypto';
import fs from 'node:fs';
import { z } from 'zod';
import { isNewer } from './version.ts';

export const APP_ID = 'io.github.mortyq.balanceinsights';
/** Same pattern as scripts/update-sign.mjs: a file name can never carry a path. */
export const INSTALLER = /^Balance-Insights-(\d+\.\d+\.\d+)-(mac|win|linux)-(arm64|x64)\.(dmg|exe|AppImage)$/;

const ManifestFile = z.strictObject({
  os: z.enum(['mac', 'win', 'linux']),
  arch: z.enum(['arm64', 'x64']),
  name: z.string().regex(INSTALLER),
  size: z.number().int().positive(),
  sha512: z.string().regex(/^[A-Za-z0-9+/]{86}==$/),
});
const Manifest = z.strictObject({
  app: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  released: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  files: z.array(ManifestFile).min(1).max(10),
});
export type Manifest = z.infer<typeof Manifest>;
export type ManifestFile = z.infer<typeof ManifestFile>;

export type RejectCode = 'signature' | 'format' | 'app' | 'not-newer' | 'file-name';

export class UpdateRejected extends Error {
  override name = 'UpdateRejected';
  constructor(readonly code: RejectCode) {
    super(`update rejected: ${code}`);
  }
}

/**
 * Verifies the signature over the exact bytes first (nothing is parsed before that), then the content.
 * `signatureText` is the base64 content of update.json.sig.
 */
export function verifyManifest(bytes: Uint8Array, signatureText: string, publicKeyPem: string, currentVersion: string): Manifest {
  const sig = Buffer.from(signatureText.trim(), 'base64');
  let ok = false;
  try {
    ok = sig.length === 64 && verify(null, bytes, createPublicKey(publicKeyPem), sig);
  } catch {
    ok = false;
  }
  if (!ok) throw new UpdateRejected('signature');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    throw new UpdateRejected('format');
  }
  const m = Manifest.safeParse(parsed);
  if (!m.success) throw new UpdateRejected('format');
  if (m.data.app !== APP_ID) throw new UpdateRejected('app');
  if (!isNewer(m.data.version, currentVersion)) throw new UpdateRejected('not-newer');
  for (const f of m.data.files) {
    const n = INSTALLER.exec(f.name);
    if (!n || n[1] !== m.data.version || n[2] !== f.os || n[3] !== f.arch) throw new UpdateRejected('file-name');
  }
  return m.data;
}

const OS: Partial<Record<NodeJS.Platform, ManifestFile['os']>> = { darwin: 'mac', win32: 'win', linux: 'linux' };

/** The installer for this machine, or null (e.g. Windows on arm64: only x64 is built). */
export function pickFile(m: Manifest, platform: NodeJS.Platform, arch: string): ManifestFile | null {
  const os = OS[platform];
  return m.files.find((f) => f.os === os && f.arch === arch) ?? null;
}

/** Size and sha512 of a downloaded file against the signed manifest. */
export async function fileMatches(file: string, expected: Pick<ManifestFile, 'size' | 'sha512'>): Promise<boolean> {
  const stat = await fs.promises.stat(file).catch(() => null);
  if (!stat || stat.size !== expected.size) return false;
  const hash = createHash('sha512');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('base64') === expected.sha512;
}

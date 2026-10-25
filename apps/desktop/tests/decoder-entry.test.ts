// The statement decoder's entry (src/decoder/process.ts) and its wiring in main, checked as source: it only runs
// inside Electron. Its halves are tested in decoder.test.ts, main's client in decoder-client.test.ts.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

describe('decoder process entry', () => {
  const code = read('../src/decoder/process.ts');

  it('checks what comes in (DecodeMessage.safeParse) and what goes out (FromDecoder.parse), one reply', () => {
    expect(code).toMatch(/DecodeMessage\.safeParse\(event\.data\)/);
    expect(code).toMatch(/port\.postMessage\(FromDecoder\.parse\(msg\)\)/);
    expect(code.match(/port\.postMessage\(/g)).toHaveLength(1);
  });

  it('one file per process: a second message is ignored', () => {
    expect(code).toMatch(/if \(taken\) return;/);
    expect(code).toMatch(/taken = true;/);
  });

  it('no network, no Electron API, no environment or arguments; it never exits by itself (main kills it on the reply)', () => {
    expect(code).not.toMatch(/from ['"]electron['"]|\bnet\b|allowlist|fetch\(/);
    expect(code).not.toMatch(/process\.env|process\.argv|process\.exit\(/);
  });

  it('main forks it per file with an empty env and passes nothing on the command line; kills it on quit', () => {
    const main = read('../src/main/index.ts');
    expect(main).toMatch(/import decoderPath from '\.\.\/decoder\/process\.ts\?modulePath';/);
    expect(main).toMatch(/utilityProcess\.fork\(decoderPath, \[\], \{ serviceName: 'balance-decoder', env: \{\}/);
    expect(main.match(/fork\(decoderPath/g)).toHaveLength(1);
    expect(main).toMatch(/app\.on\('before-quit', \(\) => decoder\.kill\(\)\)/);
  });
});

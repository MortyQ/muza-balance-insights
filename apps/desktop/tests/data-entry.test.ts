// The data process's entry (src/data/process.ts) and its wiring in main, checked as source (it only runs inside
// Electron; its handler table is tested in data-host.test.ts, the client in data-client.test.ts).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

describe('data process entry', () => {
  const code = read('../src/data/process.ts');

  it('validates what comes in (ToData) and what goes out (FromData.parse)', () => {
    expect(code).toMatch(/ToData\.safeParse\(event\.data\)/);
    expect(code).toMatch(/port\.postMessage\(FromData\.parse\(msg\)\)/);
    expect(code.match(/port\.postMessage\(/g)).toHaveLength(1);
  });

  it('no network, no Electron API, no environment or arguments; exits only on `close`', () => {
    expect(code).not.toMatch(/from ['"]electron['"]|\bnet\b|allowlist|fetch\(/);
    expect(code).not.toMatch(/process\.env|process\.argv/);
    expect(code.match(/process\.exit\(/g)).toHaveLength(1);
    expect(code).toMatch(/msg\.type === 'close'/);
  });

  it('the key comes only in `open` and opens the file; an open that fails says only whether the key fits', () => {
    expect(code).toMatch(/openLibsql\(`file:\$\{dbPath\}`, dbKey \? \{ encryptionKey: dbKey \} : \{\}\)/);
    expect(code).toMatch(/void open\(msg\.dbPath, msg\.dbKey\)/);
    expect(code).toMatch(/kind: notADatabase\(err\) \? 'unreadable' : 'failed', name: nameOf\(err\)/);
  });

  it('main forks it with an empty env, never passes the key on the command line, and gives it the database of DbAccess', () => {
    const main = read('../src/main/index.ts');
    expect(main).toMatch(/import dataPath from '\.\.\/data\/process\.ts\?modulePath';/);
    expect(main).toMatch(/utilityProcess\.fork\(dataPath, \[\], \{ serviceName: 'balance-data', env: \{\}/);
    expect(main).not.toMatch(/fork\(dataPath[^)]*(dbKey|forProcess)/i);
    expect(main).toMatch(/db: \(\) => access\.forProcess\(\)/);
    expect(main).toMatch(/unreadable: \(\) => access\.markUnreadable\(\)/);
  });
});

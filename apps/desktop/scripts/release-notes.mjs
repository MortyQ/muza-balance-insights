// The release description is the version's section of CHANGELOG.md (written for users, rule in CLAUDE.md "Process").
//   node apps/desktop/scripts/release-notes.mjs check 0.1.4   — fails unless the section exists, is dated and not empty
//   node apps/desktop/scripts/release-notes.mjs notes 0.1.4   — prints the section without its heading
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CHANGELOG_FILE = fileURLToPath(new URL('../../../CHANGELOG.md', import.meta.url));
export const UNRELEASED = 'unreleased';
const HEADING = /^## (\d+\.\d+\.\d+) — (.+)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The version sections in file order; `status` is the text after the dash (a date or «unreleased»).
 * @param {string} text
 * @returns {Array<{ version: string; status: string; body: string }>}
 */
export function parseChangelog(text) {
  /** @type {Array<{ version: string; status: string; lines: string[] }>} */
  const out = [];
  for (const line of text.split('\n')) {
    const m = HEADING.exec(line);
    if (m?.[1] && m[2]) out.push({ version: m[1], status: m[2].trim(), lines: [] });
    else if (line.startsWith('## ')) throw new Error(`CHANGELOG.md: a heading not in the form "## X.Y.Z — date": ${line}`);
    else out.at(-1)?.lines.push(line);
  }
  return out.map(({ version, status, lines }) => ({ version, status, body: lines.join('\n').trim() }));
}

/**
 * The body of `version`'s section, for a release: exactly one section, dated (not «unreleased»), not empty.
 * @param {string} text
 * @param {string} version
 * @returns {string}
 */
export function releaseNotes(text, version) {
  const found = parseChangelog(text).filter((s) => s.version === version);
  const [s] = found;
  if (!s) throw new Error(`CHANGELOG.md has no section for ${version}`);
  if (found.length > 1) throw new Error(`CHANGELOG.md has ${found.length} sections for ${version}`);
  if (s.status === UNRELEASED) throw new Error(`CHANGELOG.md: ${version} is still "${UNRELEASED}" — put the release date there`);
  if (!DATE.test(s.status)) throw new Error(`CHANGELOG.md: ${version} is dated "${s.status}", expected YYYY-MM-DD`);
  if (s.body === '') throw new Error(`CHANGELOG.md: the section for ${version} is empty`);
  return s.body;
}

/** @param {string[]} argv */
function main([mode, version]) {
  if ((mode !== 'check' && mode !== 'notes') || !version) {
    console.error('usage: release-notes.mjs check|notes <version>');
    process.exit(2);
  }
  try {
    const notes = releaseNotes(fs.readFileSync(CHANGELOG_FILE, 'utf8'), version);
    if (mode === 'notes') process.stdout.write(`${notes}\n`);
    else console.log(`CHANGELOG.md: ${version} is ready for release`);
  } catch (err) {
    console.error(`::error::${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) main(process.argv.slice(2));

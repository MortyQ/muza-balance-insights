import type { CommitUploadResult, UploadAccountView, UploadFileView } from '@contract/api.ts';
import { t } from '@/shared/lib';
import type { UploadSummary } from './types.ts';

/** An account the sheet asks about: no connection has it. */
export const needsPerson = (a: Readonly<UploadAccountView>): boolean => a.match === null;

/** Per file, per account: the only person when there is one, else nothing yet; null for a matched account. */
export function initialChoices(files: ReadonlyArray<UploadFileView>, onlyPerson: number | null): Array<Array<number | null>> {
  return files.map((f) => (f.ok ? f.accounts.map((a) => (needsPerson(a) ? onlyPerson : null)) : []));
}

/** A file is written when every account has a place and none is blocked. */
export function fileReady(f: Readonly<UploadFileView>, choices: ReadonlyArray<number | null>): boolean {
  return f.ok && f.accounts.every((a, j) => a.blocked === null && (!needsPerson(a) || choices[j] !== null));
}

export function summary(files: ReadonlyArray<UploadFileView>, choices: ReadonlyArray<ReadonlyArray<number | null>>): UploadSummary {
  let ready = 0;
  let waiting = 0;
  let added = 0;
  for (const [i, f] of files.entries()) {
    if (!f.ok) continue;
    const c = choices[i] ?? [];
    if (fileReady(f, c)) {
      ready += f.accounts.length;
      added += f.accounts.reduce((n, a) => n + a.added, 0);
    } else waiting += f.accounts.filter((a, j) => a.blocked === null && needsPerson(a) && c[j] === null).length;
  }
  return { ready, waiting, added };
}

/** After «Import»: what was added, and how many files stayed unwritten. */
export function doneText(r: Extract<CommitUploadResult, { written: true }>): string {
  const left = r.files.filter((f) => !f.written && f.reason !== 'unread').length;
  const added = t('integrations.quick.added', { count: r.added });
  return left === 0 ? added : `${added} ${t('integrations.quick.leftOut', { count: left })}`;
}

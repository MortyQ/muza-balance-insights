import type { LockResult } from '@contract/lock.ts';

export function waitText(retryAt: number | null, now: number): string {
  if (retryAt === null || retryAt <= now) return '';
  const sec = Math.ceil((retryAt - now) / 1000);
  return sec < 60 ? `Следующая попытка через ${sec} с` : `Следующая попытка через ${Math.ceil(sec / 60)} мин`;
}

export function resultText(r: LockResult): string {
  if (r.ok) return '';
  switch (r.reason) {
    case 'wrong-pin':
      return 'Неверный PIN.';
    case 'wait':
      return 'Слишком много попыток. Подожди и попробуй снова.';
    case 'cancelled':
      return 'Touch ID отменён.';
    case 'unavailable':
      return 'Этот способ сейчас недоступен.';
  }
}

export function isChecked(e: Event): boolean {
  return e.target instanceof HTMLInputElement && e.target.checked;
}

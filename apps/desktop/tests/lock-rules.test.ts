// PIN rules shared by main (the final check) and the renderer (the hint under the field).
import { describe, expect, it } from 'vitest';
import { DEFAULT_TRIGGERS, LOCK_TRIGGERS, PIN_RE, pinProblem } from '../src/shared/lock.ts';

describe('pinProblem', () => {
  it.each(['2580', '1357', '739164', '90817263', '1243'])('%s is fine', (pin) => {
    expect(pinProblem(pin)).toBeNull();
  });

  it.each([
    ['', 'цифр'],
    ['123', 'цифр'],
    ['123456789', 'цифр'],
    ['12a4', 'цифр'],
    [' 2580', 'цифр'],
    ['0000', 'одинаковые'],
    ['777777', 'одинаковые'],
    ['1234', 'подряд'],
    ['345678', 'подряд'],
    ['9876', 'подряд'],
    ['43210', 'подряд'],
  ])('%j → %s', (pin, word) => {
    expect(pinProblem(pin)).toContain(word);
  });

  it('PIN_RE is exactly 4–8 digits', () => {
    expect(PIN_RE.test('0123')).toBe(true);
    expect(PIN_RE.test('01234567')).toBe(true);
    expect(PIN_RE.test('012')).toBe(false);
    expect(PIN_RE.test('012345678')).toBe(false);
  });

  it('every trigger is on by default', () => {
    expect(LOCK_TRIGGERS.map((t) => DEFAULT_TRIGGERS[t])).toEqual([true, true, true, true]);
  });
});

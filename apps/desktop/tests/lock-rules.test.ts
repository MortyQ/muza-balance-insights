// PIN rules shared by main (the final check) and the renderer (the hint under the field).
import { describe, expect, it } from 'vitest';
import { DEFAULT_TRIGGERS, LOCK_TRIGGERS, PIN_RE, pinProblem } from '../src/shared/lock.ts';

describe('pinProblem', () => {
  it.each(['2580', '1357', '739164', '90817263', '1243'])('%s is fine', (pin) => {
    expect(pinProblem(pin)).toBeNull();
  });

  it.each([
    ['', 'length'],
    ['123', 'length'],
    ['123456789', 'length'],
    ['12a4', 'length'],
    [' 2580', 'length'],
    ['0000', 'same'],
    ['777777', 'same'],
    ['1234', 'sequence'],
    ['345678', 'sequence'],
    ['9876', 'sequence'],
    ['43210', 'sequence'],
    ['0123', 'sequence'],
    ['12345678', 'sequence'],
    ['87654321', 'sequence'],
    ['01234567', 'sequence'],
    ['76543210', 'sequence'],
    ['99999999', 'same'],
  ])('%j → %s', (pin, problem) => {
    expect(pinProblem(pin)).toBe(problem);
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

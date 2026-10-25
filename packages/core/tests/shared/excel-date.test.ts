// Excel serial dates read in the statement's zone.
import { describe, expect, it } from 'vitest';
import { excelSerialToUnix } from '../../src/shared/excel-date.ts';

const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);

describe('excelSerialToUnix', () => {
  it.each([
    ['45200', 'Europe/Kyiv', '2023-10-01T00:00:00+03:00'],
    ['45200.5', 'Europe/Kyiv', '2023-10-01T12:00:00+03:00'],
    ['45200.75', 'UTC', '2023-10-01T18:00:00Z'],
    // 09:05:11 as Excel stores it: the fraction rounds to the second.
    ['45568.378599537', 'Europe/Kyiv', '2024-10-03T09:05:11+03:00'],
    // Winter time: +02:00.
    ['45292.25', 'Europe/Kyiv', '2024-01-01T06:00:00+02:00'],
    // The last second of a day does not spill into the next.
    ['45200.999988426', 'Europe/Kyiv', '2023-10-01T23:59:59+03:00'],
    ['61', 'UTC', '1900-03-01T00:00:00Z'],
  ])('%s in %s → %s', (serial, zone, iso) => {
    expect(excelSerialToUnix(serial, zone)).toBe(at(iso));
  });

  it.each([[''], ['abc'], ['-1'], ['1e5'], ['45 200'], ['60'], ['0']])('%s does not read', (serial) => {
    expect(excelSerialToUnix(serial, 'Europe/Kyiv')).toBeNull();
  });
});

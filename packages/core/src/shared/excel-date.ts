// Dates in spreadsheets: a date cell holds an Excel serial — days since 1899-12-30, the time of day as the fraction —
// stated in the wall clock of the statement's zone.
import { TZDate } from '@date-fns/tz';

const EPOCH_MS = Date.UTC(1899, 11, 30);

/**
 * The text of an Excel serial → unix seconds of that wall-clock moment in `timeZone`, to the nearest second; null if it
 * is not a number, or falls before March 1900 (Excel's 1900 calendar counts a day that never was).
 */
export function excelSerialToUnix(serial: string, timeZone: string): number | null {
  if (!/^\d+(?:\.\d+)?$/.test(serial.trim())) return null;
  const value = Number(serial);
  if (value < 61) return null;
  const total = Math.round(value * 86_400);
  const days = Math.floor(total / 86_400);
  const sec = total - days * 86_400;
  const day = new Date(EPOCH_MS + days * 86_400_000);
  const t = new TZDate(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    Math.floor(sec / 3600),
    Math.floor((sec % 3600) / 60),
    sec % 60,
    timeZone,
  );
  return Math.floor(t.getTime() / 1000);
}

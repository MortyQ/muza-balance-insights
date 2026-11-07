// A Czech account number (`[prefix-]number/bank code`) as its IBAN: CZ, two check digits (ISO 7064 mod 97-10), the
// 4-digit bank code, the 6-digit prefix and the 10-digit number, each padded with zeros. Pure.

const ACCOUNT_RE = /^(?:(\d{1,6})-)?(\d{1,10})$/;

/** The remainder of a long digit string by 97, in chunks (no float, no BigInt). */
function mod97(digits: string): number {
  let rest = 0;
  for (let i = 0; i < digits.length; i += 7) rest = Number(`${rest}${digits.slice(i, i + 7)}`) % 97;
  return rest;
}

/** The IBAN of a Czech account, or null when the number or the bank code is not one. */
export function czIban(account: string, bankCode: string): string | null {
  const m = ACCOUNT_RE.exec(account.trim());
  if (!m || !/^\d{4}$/.test(bankCode.trim())) return null;
  const bban = bankCode.trim() + (m[1] ?? '').padStart(6, '0') + m[2]!.padStart(10, '0');
  // C = 12, Z = 35; the check digits are 98 minus the remainder of BBAN + "CZ00".
  const check = 98 - mod97(`${bban}123500`);
  return `CZ${String(check).padStart(2, '0')}${bban}`;
}

/** `[prefix-]number/bank code` (the file's title line) → its IBAN, or null. */
export function czIbanOfSlashed(text: string): string | null {
  const m = /^\s*([\d-]+)\/(\d{4})\s*$/.exec(text);
  return m ? czIban(m[1]!, m[2]!) : null;
}

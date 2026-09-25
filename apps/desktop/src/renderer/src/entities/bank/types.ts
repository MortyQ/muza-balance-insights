export type BankId = 'monobank' | 'privatbank' | 'other';

export interface Bank {
  id: BankId;
  name: string;
  status: 'available' | 'soon';
  /** Shown when there is no logo file: one or two letters on a square. */
  monogram: string;
  /** Tailwind classes of the monogram square. */
  monogramClass: string;
  /** How to get the token, step by step. Plain text: the app opens no external links. */
  tokenSteps: ReadonlyArray<string>;
  tokenPlaceholder: string;
}

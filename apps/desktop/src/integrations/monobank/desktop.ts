// Monobank, main's side: the shape of its credential.
import type { DesktopProvider } from '../types.ts';

export const monobank = { bank: 'Monobank', credential: /^\S{20,200}$/ } as const satisfies DesktopProvider;

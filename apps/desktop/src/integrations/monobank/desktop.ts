// Monobank, the desktop's side: its client reaches only the `monobank` service.
import type { DesktopProvider } from '../types.ts';

export const monobank = { service: 'monobank' } as const satisfies DesktopProvider;

export type TokensStorage = { ok: boolean; badge: string; hint: string };

/** The «Токены» row; null while main has not said whether this machine has a secret store. */
export function tokensStorage(secure: boolean | null, storeName: string): TokensStorage | null {
  if (secure === null) return null;
  return secure
    ? {
        ok: true,
        badge: 'Шифрование доступно',
        hint: `Зашифрованы ${storeName}. Прочитать их может только это приложение под твоей учётной записью.`,
      }
    : {
        ok: false,
        badge: 'Шифрование недоступно',
        hint: 'Системное хранилище недоступно: токены живут только в памяти до закрытия приложения.',
      };
}

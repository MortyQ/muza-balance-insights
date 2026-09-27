/** Shown wherever a token of another person may be added. */
export const CONSENT_TEXT =
  'Токен выпускает сам владелец счетов в своём Monobank и передаёт его тебе. Токен открывает чтение всех его выписок и балансов — добавляй только с его согласия.';

export const DUPLICATE_TOKEN_TEXT = 'Этот токен уже подключён.';

/** How to get the token, step by step. Plain text: the app opens no external links. */
export const TOKEN_STEPS = [
  'Открой в браузере api.monobank.ua и войди через приложение Monobank (QR-код).',
  'Скопируй личный токен и вставь его сюда.',
] as const;

export const TOKEN_PLACEHOLDER = 'Токен с api.monobank.ua';

/** Under the bank's name on the first connect screen. */
export const ACCESS_NOTE = 'Токен даёт только чтение выписки и балансов и хранится на этом компьютере.';

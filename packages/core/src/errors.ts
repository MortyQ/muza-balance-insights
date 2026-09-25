// Errors every provider client raises in the same shape, so the sync loop, the CLI and the app handle them without
// knowing the bank. None of them carries a token, a URL with secrets, headers, amounts or descriptions.

export class RateLimitError extends Error {
  override name = 'RateLimitError';
  constructor(
    readonly retryAfterSec: number,
    readonly source: 'local' | 'server',
    /** Shown in the message: «Monobank». */
    bank: string,
    /** The bank's limit, for the local message. */
    intervalSec: number,
  ) {
    super(
      source === 'server'
        ? `${bank} вернул 429 (rate limit). Повтори через ${retryAfterSec} с.`
        : `Лимит ${bank} API: 1 запрос в ${intervalSec} с. Следующий запрос возможен через ${retryAfterSec} с.`,
    );
  }
}

/**
 * A statement item failed validation. Carries only field names and the transaction id —
 * never amounts, descriptions or counterparties.
 */
export class StatementFormatError extends Error {
  override name = 'StatementFormatError';
  constructor(
    readonly fields: string[],
    readonly transactionId: string | null,
    readonly itemIndex: number,
  ) {
    super(
      `Неожиданный формат транзакции ${transactionId ?? `#${itemIndex} (без id)`}: поля ${fields.join(', ')}`,
    );
  }
}

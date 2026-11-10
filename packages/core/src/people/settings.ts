// User settings (table settings). Changed by the user via scripts/settings.ts or the desktop (cash_is_spending); read
// by the scope pass, the spending reads and, in phase 5, by the MCP tools. Only non-default values are stored.
import type { Db } from '../storage/db.ts';

export const SETTING_DEFAULTS = {
  /**
   * Treasury payments («ГУК…») from any card count as business. Off by default: taxes paid from a personal card are
   * personal spending (a business account's stay business by its own rule); on → the other way round, with scope
   * overrides for the exceptions.
   */
  treasury_business: false,
  /** Tool outputs show full counter_name instead of the mask «О. Т.». Never a tool parameter. */
  reveal_full_names: false,
  /**
   * Cash withdrawals («наличные») count as spending. Off: every spending read leaves them out like own transfers
   * (read/spending.ts); the desktop's «Categories» section changes it.
   */
  cash_is_spending: true,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, boolean>;

export class SettingsError extends Error {
  override name = 'SettingsError';
}

export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as string[]).includes(key);
}

export async function getSettings(db: Db): Promise<Settings> {
  const settings: Settings = { ...SETTING_DEFAULTS };
  const rs = await db.execute('SELECT key, value FROM settings');
  for (const r of rs.rows) {
    const key = String(r.key);
    if (isSettingKey(key)) settings[key] = r.value === 'on';
  }
  return settings;
}

/** Validates key and value (on | off). Storing the default value removes the row. */
export async function setSetting(db: Db, key: string, value: string): Promise<{ key: SettingKey; value: boolean }> {
  if (!isSettingKey(key)) throw new SettingsError(`Неизвестная настройка «${key}». Допустимые: ${SETTING_KEYS.join(', ')}`);
  if (value !== 'on' && value !== 'off') throw new SettingsError(`Значение: on или off, получено «${value}»`);
  const on = value === 'on';
  if (on === SETTING_DEFAULTS[key]) {
    await db.execute({ sql: 'DELETE FROM settings WHERE key = ?', args: [key] });
  } else {
    await db.execute({
      sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      args: [key, value],
    });
  }
  return { key, value: on };
}

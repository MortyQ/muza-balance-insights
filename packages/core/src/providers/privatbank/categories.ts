// PrivatBank's own categories (as Privat24 states them per row) → the common ones. null = a category the bank uses
// whose rows the rules decide by shape: transfers (income or p2p by sign, own transfers by the derivation).
// A bank category not here gets no hint and is reported by the re-derivation as unknown.
import type { CategoryHint } from '../types.ts';

export const TRANSFER_CATEGORIES: ReadonlySet<string> = new Set([
  'Перекази',
  'Зарахування переказу',
  'Переказ на свою картку',
  'Зарахування зі своєї картки',
  'Заощадження',
  'Платежі за реквізитами',
]);

export const BANK_CATEGORIES: ReadonlyMap<string, CategoryHint | null> = new Map<string, CategoryHint | null>([
  ...[...TRANSFER_CATEGORIES].map((c): [string, null] => [c, null]),
  ['Супермаркети та продукти', 'groceries'],
  ['Ресторани, кафе, бари', 'cafes'],
  ['Транспорт', 'transport'],
  ['Таксі', 'transport'],
  ['Аптеки', 'health'],
  ['Краса', 'beauty'],
  ['Одяг та взуття', 'clothing'],
  ['Дім та ремонт', 'home'],
  ['Побутова техніка', 'home'],
  ['Поповнення мобільного', 'telecom'],
  ['Комуналка та Інтернет', 'utilities'],
  ['Розваги', 'entertainment'],
  ['Цифрові товари', 'entertainment'],
  ['Інтернет-магазини', 'marketplaces'],
  ['Зняття готівки', 'cash'],
  ['Освіта', 'education'],
  ['Квіти', 'gifts'],
  ['Фонди та організації', 'charity'],
  ['Платежі до бюджету', 'taxes'],
  ['Зарахування', 'income'],
  ['Послуги', null],
  ['Інше', null],
]);

// A fictional Privat24 card statement as the desktop decodes it (a workbook's first sheet). Invented data only.
import type { Cell, StatementDocument } from '../../../src/providers/types.ts';

export const TITLE = 'Історія операцій за період 01.01.2026 - 31.01.2026';
export const HEADER = [
  'Дата',
  'Категорія',
  'Картка',
  'Опис операції',
  'Сума в валюті картки',
  'Валюта картки',
  'Сума в валюті транзакції',
  'Валюта транзакції',
  'Залишок на кінець періоду',
  'Валюта залишку',
];

export const TITLE_EN = 'Transaction history for the period 01.01.2026 - 31.01.2026';
export const HEADER_EN = [
  'Date',
  'Category',
  'Card',
  'Description',
  'Amount in card currency',
  'Card currency',
  'Amount in transaction currency',
  'Transaction currency',
  'Rest at the end of the period',
  'Rest currency',
];

export const CARD_A = '5168 **** **** 1111';
export const CARD_B = '4149 **** **** 2222';

const s = (v: string): Cell => ({ t: 's', v });
const n = (v: string): Cell => ({ t: 'n', v });

/** One operation row: [time, category, card, description, amount, currency, op amount, op currency, balance]. */
export type Op = [string, string, string, string, string, string, string, string, string];

export const op = ([time, category, card, description, amount, currency, opAmount, opCurrency, balance]: Op): Cell[] => [
  s(time),
  s(category),
  s(card),
  s(description),
  n(amount),
  s(currency),
  n(opAmount),
  s(opCurrency),
  n(balance),
  s(currency),
];

export function sheet(rows: Cell[][], opts: { title?: boolean; trailingEmpty?: number; en?: boolean } = {}): StatementDocument {
  const empty: Cell[] = Array.from({ length: 10 }, () => null);
  return {
    format: 'sheets',
    sheets: [
      {
        name: opts.en ? 'Statement' : 'Виписка',
        rows: [
          ...(opts.title === false ? [] : [[s(opts.en ? TITLE_EN : TITLE), ...Array.from({ length: 9 }, () => null)]]),
          (opts.en ? HEADER_EN : HEADER).map(s),
          ...rows,
          ...Array.from({ length: opts.trailingEmpty ?? 0 }, () => empty),
        ],
      },
    ],
  };
}

/** Newest first, as the bank writes it: two cards, a euro purchase, a fee on top, a withheld fee, own and jar transfers. */
export const OPS: Op[] = [
  ['20.01.2026 18:30:00', 'Перекази', CARD_A, 'Вигадана Особа', '-105.00', 'UAH', '100.00', 'UAH', '1450.00'],
  ['18.01.2026 12:00:05', 'Зарахування переказу', CARD_A, 'від Вигаданий Відправник', '995.00', 'UAH', '1000.00', 'UAH', '1555.00'],
  ['15.01.2026 09:15:00', 'Інтернет-магазини', CARD_A, 'Вигаданий магазин', '-430.50', 'UAH', '10.00', 'EUR', '560.00'],
  ['12.01.2026 10:00:00', 'Переказ на свою картку', CARD_A, 'На свою картку *2222', '-200.00', 'UAH', '200.00', 'UAH', '990.50'],
  ['12.01.2026 10:00:00', 'Зарахування зі своєї картки', CARD_B, 'Зі своєї картки *1111', '200.00', 'UAH', '200.00', 'UAH', '300.00'],
  ['10.01.2026 08:00:00', 'Заощадження', CARD_A, 'Скарбничка', '-9.50', 'UAH', '9.50', 'UAH', '1190.50'],
  ['05.01.2026 14:45:10', 'Супермаркети та продукти', CARD_A, 'Вигаданий супермаркет', '-300.00', 'UAH', '300.00', 'UAH', '1200.00'],
  ['03.01.2026 11:00:00', 'Супермаркети та продукти', CARD_B, 'Вигаданий супермаркет', '-50.00', 'UAH', '50.00', 'UAH', '100.00'],
];

/** OPS as the English statement states them. */
export const OPS_EN: Op[] = [
  ['20.01.2026 18:30:00', 'Transfers', CARD_A, 'Made-up Person', '-105.00', 'UAH', '100.00', 'UAH', '1450.00'],
  ['18.01.2026 12:00:05', 'Transfer crediting', CARD_A, 'from Made-up Sender', '995.00', 'UAH', '1000.00', 'UAH', '1555.00'],
  ['15.01.2026 09:15:00', 'Online stores', CARD_A, 'Made-up Shop', '-430.50', 'UAH', '10.00', 'EUR', '560.00'],
  ['12.01.2026 10:00:00', 'Transfer to my card', CARD_A, 'To my card *2222', '-200.00', 'UAH', '200.00', 'UAH', '990.50'],
  ['12.01.2026 10:00:00', 'Transfer from my card', CARD_B, 'From my card *1111', '200.00', 'UAH', '200.00', 'UAH', '300.00'],
  ['10.01.2026 08:00:00', 'Savings', CARD_A, 'Moneybox', '-9.50', 'UAH', '9.50', 'UAH', '1190.50'],
  ['05.01.2026 14:45:10', 'Supermarkets and groceries', CARD_A, 'Made-up Supermarket', '-300.00', 'UAH', '300.00', 'UAH', '1200.00'],
  ['03.01.2026 11:00:00', 'Supermarkets and groceries', CARD_B, 'Made-up Supermarket', '-50.00', 'UAH', '50.00', 'UAH', '100.00'],
];

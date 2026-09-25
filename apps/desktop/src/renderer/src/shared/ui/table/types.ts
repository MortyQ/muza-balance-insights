export type TableAlign = 'start' | 'end';

export interface TableColumn<Row> {
  key: string;
  label: string;
  /** The header is read by screen readers only (a column of bars, icons). */
  hideLabel?: boolean;
  align?: TableAlign;
  /** Any CSS width, e.g. "34%". Unset = sized by content. */
  width?: string;
  /** secondary: a quieter text colour for supporting numbers. */
  tone?: 'default' | 'secondary';
  strong?: boolean;
  /** Cell text. A `cell-<key>` slot replaces it (and receives it as `value`). */
  value?: (row: Row) => string;
}

export interface TableFooterCell {
  text: string;
  colspan?: number;
  align?: TableAlign;
}

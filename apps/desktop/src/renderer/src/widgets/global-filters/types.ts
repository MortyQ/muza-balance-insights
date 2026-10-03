/** The sync status on the right of the home filters, ready to render (`syncStatusView`). */
export type SyncStatusView = {
  icon: 'spinner' | 'warning' | null;
  /** Read out on change (role="status"): the same for every tick of one phase, so it is announced once per phase. */
  text: string;
  /** «42%» while windows download; shown, not announced. */
  percent: string;
  /** What went wrong: for screen readers here, and the same text in the tooltip. */
  note: string;
  /** On hover; '' = none. */
  tooltip: string;
  /** An import is in flight. */
  busy: boolean;
};

export function isChecked(e: Event): boolean {
  return e.target instanceof HTMLInputElement && e.target.checked;
}

/**
 * A switch's hidden input is flipped by the browser before @change fires; when saving fails the saved state does not
 * change, so the input is put back to `value` by hand.
 */
export function restoreSwitch(e: Event, value: boolean): void {
  if (e.target instanceof HTMLInputElement) e.target.checked = value;
}

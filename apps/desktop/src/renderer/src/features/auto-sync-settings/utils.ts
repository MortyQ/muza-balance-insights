export function isChecked(e: Event): boolean {
  return e.target instanceof HTMLInputElement && e.target.checked;
}

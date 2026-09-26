// copied from muzakit/libs/ui/src (2026-09-26); no changes
/**
 * Minimal validation interface compatible with Vuelidate.
 * Using our own type avoids importing @vuelidate/core just for the type.
 * Works with any validation library that exposes $error / $errors.
 */
export interface FieldValidation {
  $error: boolean
  $errors: Array<{ $message: string | unknown }>
  $dirty: boolean
  $invalid: boolean
  $pending: boolean
  $touch(): void
  $reset(): void
}

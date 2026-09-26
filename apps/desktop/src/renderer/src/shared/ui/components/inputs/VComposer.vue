<!-- copied from muzakit/libs/ui/src (2026-09-26); changes: ui/README.md -->
<script lang="ts" setup>
import { computed, nextTick, onScopeDispose, ref, useId, useTemplateRef, watch } from "vue";

import type { FieldValidation } from "../../types/validation";
import VButton from "../base/VButton.vue";
import VIcon from "../base/VIcon.vue";
import VCollapse from "../layout/VCollapse.vue";

export type VComposerStatus = "idle" | "sending" | "sent" | "error";

/**
 * Esc, the ✕ button and the sent-watcher all fold through `collapse()`, so focus
 * recovery lives once rather than three times. If focus was inside the composer
 * when it collapses it would otherwise land on the removed textarea — move it to
 * the CTA that just took the row's place. Esc and ✕ compute `restoreFocus` from
 * the live `activeElement`; the sent-watcher passes its own, since focus may
 * already have been kicked to `<body>` by the disabled Submit button.
 */
interface CollapseOptions {
  restoreFocus?: boolean
}

const {
  initialValue = "",
  preview = "",
  placeholder = "",
  openLabel = "Write",
  submitLabel = "Send",
  status = "idle",
  validation = undefined,
  error = undefined,
  helperText = "",
  copyable = false,
  rows = 5,
} = defineProps<{
  /** Baseline for the "edited" marker and Reset. Leave empty to hide both. */
  initialValue?: string
  /** Collapsed-row text. The `preview` slot overrides it. */
  preview?: string
  placeholder?: string
  /** CTA on the collapsed row. Becomes "View" once sent. */
  openLabel?: string
  submitLabel?: string
  /**
   * Delivery state, owned by the caller's request. `error` here is a failed
   * send — not a validation error, which comes through `validation` / `error`
   * and sits under the field instead.
   */
  status?: VComposerStatus
  /** Same contract as `VInput`: display only — the caller runs `$validate()` in `@submit`. */
  validation?: FieldValidation
  /** Same contract as `VInput`'s `error`. */
  error?: string
  helperText?: string
  copyable?: boolean
  rows?: number
}>();

const emit = defineEmits<{
  submit: [value: string]
  /** Every user-initiated open, repeat opens included. Not fired for an initial `open: true`. */
  expand: []
}>();

// Local copy() in place of @vueuse/core's useClipboard (the only use of vueuse here).
const canCopy = typeof document !== "undefined";
const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

const copyViaClipboardApi = async (value: string): Promise<boolean> => {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Electron's `denyAllPermissions` (apps/desktop/src/main/hardening.ts) answers every
    // permission check with `false`, which can make this reject even from a user gesture.
    return false;
  }
};

// What vueuse's useClipboard does with `legacy: true`: an
// off-screen textarea, selected and copied via the deprecated but still-supported
// `execCommand('copy')`. Positioned through CSSOM property setters, not `cssText` or
// a string `style` attribute — prod CSP has no `style-src 'unsafe-inline'`.
const copyViaExecCommand = (value: string): boolean => {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.setProperty("position", "fixed");
  textarea.style.setProperty("top", "-1000px");
  textarea.style.setProperty("left", "-1000px");
  textarea.style.setProperty("opacity", "0");
  const previouslyFocused = document.activeElement;
  document.body.appendChild(textarea);
  textarea.select();
  let succeeded = false;
  try {
    succeeded = document.execCommand("copy");
  } catch {
    succeeded = false;
  }
  textarea.remove();
  if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
  return succeeded;
};

const copy = async (value: string): Promise<void> => {
  const succeeded = (await copyViaClipboardApi(value)) || copyViaExecCommand(value);
  if (!succeeded) return;
  copied.value = true;
  if (copiedTimer !== null) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = false;
    copiedTimer = null;
  }, 2000);
};

onScopeDispose(() => {
  if (copiedTimer !== null) clearTimeout(copiedTimer);
});

const fieldId = useId();

const field = useTemplateRef<HTMLTextAreaElement>("field");
const root = useTemplateRef<HTMLDivElement>("root");

const text = defineModel<string>({ default: "" });
// Local state when the caller does not bind it — the same `defineModel` default VCollapse uses.
const open = defineModel<boolean>("open", { default: false });

/**
 * True from the moment `submit()` fires until the sent-watcher consumes it.
 * Plain and non-reactive: nothing reads it in the template, it is a private
 * handshake between the two. It exists because `VButton` disables Submit while
 * `status` is "sending", which blurs it to `<body>` — by the time "sent"
 * arrives `root.contains(document.activeElement)` is already false, and the
 * browser's own focus drop would be read as "focus was outside".
 */
let submittedFromInside = false;

const hasError = computed(() => !!(validation?.$error || error));
const errorMessage = computed(() => validation?.$errors[0]?.$message ?? error ?? "");
const isEdited = computed(() => initialValue !== "" && text.value !== initialValue);
const isSending = computed(() => status === "sending");
const isSent = computed(() => status === "sent");

const submitText = computed(() => {
  if (status === "error") return "Retry";
  if (isSent.value) return "Send again";
  return submitLabel;
});

const expand = (): void => {
  if (open.value) return;
  open.value = true;
  emit("expand");
};

const focusIsInside = (): boolean => root.value?.contains(document.activeElement) ?? false;

const collapse = ({ restoreFocus }: CollapseOptions = {}): void => {
  const shouldRestoreFocus = restoreFocus ?? focusIsInside();
  open.value = false;
  if (!shouldRestoreFocus) return;
  nextTick(() => {
    root.value?.querySelector<HTMLButtonElement>(".v-composer__row button")?.focus();
  });
};

const reset = (): void => {
  text.value = initialValue;
  field.value?.focus();
};

const submit = (): void => {
  if (isSending.value) return;
  submittedFromInside = true;
  emit("submit", text.value);
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    submit();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    // Stop here so an Esc inside a VModal collapses the composer without also
    // closing the modal.
    event.stopPropagation();
    collapse();
  }
};

// Focus follows the open state whoever set it — a click here or a caller's
// `v-model:open`. Caret at the end, where the template leaves room to type.
watch(open, async (value) => {
  if (!value) return;
  await nextTick();
  const el = field.value;
  if (!el) return;
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
});

// Delivery confirmed — the transition *from* sending, not any arrival at sent:
// a caller may report sent again when the text is edited back to what was sent.
watch(() => status, (value, previous) => {
  if (value !== "sent" || previous !== "sending") return;
  const restoreFocus = submittedFromInside || focusIsInside();
  submittedFromInside = false;
  collapse({ restoreFocus });
});
</script>

<template>
  <div
    ref="root"
    :class="{
      'v-composer--open': open,
      'v-composer--sent': isSent && !open,
      'v-composer--error': hasError,
      'v-composer--failed': status === 'error' && !open,
    }"
    class="v-composer"
  >
    <!-- One box that grows. The collapsed row and the open header share its top
         edge, so the eye follows one object instead of a bar that vanishes and a
         panel that replaces it.

         Mouse-only row: a real button lives inside it, so the row itself is not
         a second interactive element — the CTA below is the single keyboard
         entry point. -->
    <div
      v-if="!open"
      class="v-composer__row"
      @click="expand"
    >
      <VIcon
        :icon="isSent ? 'lucide:check' : 'lucide:pen-line'"
        :size="15"
        class="v-composer__icon"
      />
      <span class="v-composer__preview">
        <slot name="preview">{{ preview || placeholder }}</slot>
      </span>
      <VButton
        :aria-controls="fieldId"
        :icon="isSent ? undefined : 'lucide:send'"
        :text="isSent ? 'View' : openLabel"
        :variant="isSent ? 'neutral' : 'primary'"
        aria-expanded="false"
        @click.stop="expand"
      />
    </div>

    <div
      v-else
      class="v-composer__meta"
    >
      <slot name="meta" />
      <span
        v-if="isEdited"
        class="v-composer__edited"
      >edited</span>
      <span class="v-composer__meta-actions">
        <VButton
          v-if="copyable && canCopy"
          :aria-label="copied ? 'Copied' : 'Copy to clipboard'"
          :icon="copied ? 'lucide:check' : 'lucide:copy'"
          variant="neutral"
          @click="copy(text)"
        />
        <VButton
          aria-label="Collapse"
          icon="lucide:x"
          variant="neutral"
          @click="collapse()"
        />
      </span>
    </div>

    <VCollapse :model-value="open">
      <div
        :inert="!open"
        class="v-composer__body"
      >
        <textarea
          :id="fieldId"
          ref="field"
          v-model="text"
          :aria-invalid="hasError"
          :aria-label="placeholder || submitLabel"
          :placeholder
          :rows
          class="v-composer__field"
          @keydown="onKeydown"
        />

        <p
          v-if="hasError"
          class="v-composer__message v-composer__message--error"
        >
          {{ errorMessage }}
        </p>
        <p
          v-else-if="helperText"
          class="v-composer__message"
        >
          {{ helperText }}
        </p>

        <div class="v-composer__footer">
          <span
            v-if="status === 'error'"
            class="v-composer__failed"
          >Couldn't send — your text is kept</span>
          <span
            v-else
            class="v-composer__hint"
          >
            <slot name="hint">
              <kbd>⌘/Ctrl</kbd> <kbd>↵</kbd> to send · <kbd>Esc</kbd> to collapse
            </slot>
          </span>

          <span class="v-composer__footer-actions">
            <VButton
              v-if="initialValue"
              :disabled="!isEdited"
              class="v-composer__reset"
              text="Reset"
              variant="neutral"
              @click="reset"
            />
            <VButton
              :loading="isSending"
              :text="submitText"
              class="v-composer__submit"
              icon="lucide:send"
              variant="primary"
              @click="submit"
            />
          </span>
        </div>
      </div>
    </VCollapse>
  </div>
</template>

<style lang="scss" scoped>
@use "../../styles/components/inputs/vcomposer.scss";
</style>

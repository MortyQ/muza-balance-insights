import { ref, type Ref } from 'vue';

/** localStorage key of a screen's introduction: once closed, it is not shown again on this computer. */
const keyOf = (id: string) => `help.seen.${id}`;

function seen(id: string): boolean {
  try {
    return localStorage.getItem(keyOf(id)) === '1';
  } catch {
    // Storage unavailable: the introduction shows each time; a convenience only.
    return false;
  }
}

export interface UseIntroReturn {
  open: Ref<boolean>;
  close: () => void;
  /** «How it works»: shows it again. */
  show: () => void;
}

/** A screen's first-visit introduction (`IntroNote` of shared/layout): open until closed once. */
export function useIntro(id: string): UseIntroReturn {
  const open = ref(!seen(id));
  const close = () => {
    open.value = false;
    try {
      localStorage.setItem(keyOf(id), '1');
    } catch {
      // Storage unavailable: closed for this session only.
    }
  };
  return { open, close, show: () => void (open.value = true) };
}

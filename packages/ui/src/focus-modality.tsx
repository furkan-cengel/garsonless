const FOCUS_MODALITY_SCRIPT = `
(() => {
  const root = document.documentElement;
  const readyKey = '__masabuFocusModalityReady';
  if (window[readyKey] === true) return;
  window[readyKey] = true;

  const usePointerModality = () => {
    root.dataset.focusModality = 'pointer';
  };

  const useKeyboardModality = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const target = event.target;
    const isTextEntry = target instanceof Element && target.matches(
      'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]'
    );
    const isNavigationKey = event.key === 'Tab' || (
      !isTextEntry && (
        event.key === 'Enter' ||
        event.key === ' ' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'Home' ||
        event.key === 'End'
      )
    );

    if (isNavigationKey) root.dataset.focusModality = 'keyboard';
  };

  window.addEventListener('pointerdown', usePointerModality, true);
  window.addEventListener('keydown', useKeyboardModality, true);
})();
`

/**
 * Installs one input-modality tracker before React hydration. Pointer focus keeps
 * its native focus state without drawing a focus indicator; keyboard navigation
 * continues to use the application's existing :focus-visible styles.
 */
export function FocusModalityScript() {
  return <script dangerouslySetInnerHTML={{ __html: FOCUS_MODALITY_SCRIPT }} />
}

export { FOCUS_MODALITY_SCRIPT }

/**
 * The nearest ancestor that actually scrolls, or null for the window.
 *
 * This site scrolls a Lenis container rather than the window. An
 * IntersectionObserver rooted at the viewport clips its target by that
 * container before applying `rootMargin`, so a margin meant to fire "a screen
 * ahead" never takes effect. Rooting the observer at the container itself
 * makes the margin work.
 */
export function getScrollRoot(el: Element): Element | null {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

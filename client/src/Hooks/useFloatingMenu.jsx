import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Renders children into document.body, escaping any clipping/overflow or stacking-context ancestors. */
export function Portal({ children }) {
  return createPortal(children, document.body);
}

/**
 * Drives the enter/exit CSS transition for a floating element (context
 * menu, submenu, dropdown...).
 *
 * - `open` true: flips to the "open" class one frame later, so there's
 *   always a committed closed frame for the browser to transition from.
 * - `open` false: drops the "open" class so the same node transitions back
 *   to its closed styles; once that transition actually finishes (per
 *   `onTransitionEnd`, filtered to the `transform` property so it only
 *   fires once), `onExited` runs.
 *
 * Mounting itself is left to the caller — some own their own mount state
 * (see `useSelfMountedTransition` below), others are mounted/unmounted by
 * a parent.
 */
export function useTransitionClass(open, onExited) {
  const [animate, setAnimate] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
    setAnimate(false);
  }, [open]);

  function onTransitionEnd(e) {
    if (e.target !== nodeRef.current) return;
    if (e.propertyName !== "transform") return;
    if (!open) onExited?.();
  }

  return { animate, nodeRef, onTransitionEnd };
}

/** Self-contained version for elements that manage their own mount/unmount (e.g. a hover-driven submenu). */
export function useSelfMountedTransition(open) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  const transition = useTransitionClass(open, () => setMounted(false));
  return { mounted, ...transition };
}
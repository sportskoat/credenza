import { useEffect } from "react";

// Shared, reference-counted body scroll lock (2026-07-27). Each modal used to
// save and restore document.body.style.overflow on its own, so two open layers
// raced: closing the inner one restored the pre-hidden value while the outer
// one still needed the lock. One module-scope count means the first lock saves
// the value and only the last release restores it.
let lockCount = 0;
let savedOverflow = "";

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  // A stray second cleanup must not push the count below zero or restore the
  // body while a real lock is still held.
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    savedOverflow = "";
  }
}

// Hook form: lock on mount, release on unmount.
export function useBodyScrollLock() {
  useEffect(() => {
    lockBodyScroll();
    return unlockBodyScroll;
  }, []);
}

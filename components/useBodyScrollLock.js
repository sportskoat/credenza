import { useEffect } from "react";

// Shared, reference-counted body scroll lock (2026-07-27). Each modal used to
// save and restore document.body.style.overflow on its own, so two open layers
// raced: closing the inner one restored the pre-hidden value while the outer
// one still needed the lock. One module-scope count means the first lock saves
// the value and only the last release restores it.
let lockCount = 0;
let savedOverflow = "";
let savedRootOverflow = "";
let lockedShell = null;
let savedShellOverflow = "";

// On a phone the shelf scrolls inside .cz-shell, not on the page: the bottom
// bar is docked as its flex sibling (shelf handoff 2026-07-28), so the app is
// a fixed-height column. Freezing <html> and <body> does not reach an inner
// scroller, so find it and freeze it too. On desktop there is no inner
// scroller and this is a no-op.
function findShellScroller() {
  if (typeof document === "undefined") return null;
  return document.querySelector('.cz-app[data-fashion="true"] > .cz-shell');
}

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The page itself scrolls on <html>, not on <body>, so hiding only the
    // body left the shelf free to move. A drag that started on the photo, the
    // buy bar, or any gap — anywhere outside the sheet's own scrolling area —
    // fell through and scrolled the shelf behind the open card (Kyle
    // 2026-07-28: "it can sometimes catch the back of the card list, unless
    // you hit it right"). Locking both stops every one of those gestures.
    savedRootOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    lockedShell = findShellScroller();
    if (lockedShell) {
      savedShellOverflow = lockedShell.style.overflow;
      lockedShell.style.overflow = "hidden";
    }
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
    document.documentElement.style.overflow = savedRootOverflow;
    savedOverflow = "";
    savedRootOverflow = "";
    if (lockedShell) {
      lockedShell.style.overflow = savedShellOverflow;
      lockedShell = null;
      savedShellOverflow = "";
    }
  }
}

// Hook form: lock on mount, release on unmount.
export function useBodyScrollLock() {
  useEffect(() => {
    lockBodyScroll();
    return unlockBodyScroll;
  }, []);
}

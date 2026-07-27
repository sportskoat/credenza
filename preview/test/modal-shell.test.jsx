// ModalShell (components/ModalShell.jsx) tests, 2026-07-27.
//
// Two subjects:
//   1. The shared, reference-counted body scroll lock
//      (components/useBodyScrollLock.js). Two open modals used to race their
//      private save/restore effects: closing the inner one brought the body
//      scroll back while the outer one still needed the lock.
//   2. Sub-page navigation after the measurement removal: one stable dialog
//      width, both pages mounted, inert/aria-hidden on the inactive page,
//      Back and Escape intact.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ModalShell } from "../../components/ModalShell.jsx";
import {
  lockBodyScroll,
  unlockBodyScroll,
} from "../../components/useBodyScrollLock.js";

const SUB_PAGE = {
  key: "sub",
  title: "Sub page",
  maxWidth: 300, // accepted for compatibility; the shell must ignore it
  node: <p>Sub content</p>,
};

function renderShell(props = {}) {
  return render(
    <ModalShell title="Parent" onClose={() => {}} maxWidth={440} stacked {...props}>
      <p>Parent content</p>
    </ModalShell>
  );
}

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("useBodyScrollLock", () => {
  it("keeps the body locked until the LAST nested lock releases", () => {
    document.body.style.overflow = "scroll";
    lockBodyScroll();
    lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");

    // One cleanup must not restore scrolling while another lock remains.
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");

    // The final cleanup restores the ORIGINAL value, not "hidden".
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("never lets the count go negative on a stray extra cleanup", () => {
    document.body.style.overflow = "scroll";
    lockBodyScroll();
    unlockBodyScroll();
    unlockBodyScroll(); // no lock held: must be a no-op
    expect(document.body.style.overflow).toBe("scroll");

    // A later lock still saves and restores cleanly.
    lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("two mounted ModalShells nest: the first unmount does not unlock", () => {
    document.body.style.overflow = "auto";
    const a = render(<ModalShell title="A" onClose={() => {}}>A body</ModalShell>);
    const b = render(<ModalShell title="B" onClose={() => {}}>B body</ModalShell>);
    expect(document.body.style.overflow).toBe("hidden");

    a.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    b.unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});

describe("ModalShell sub-page navigation", () => {
  it("keeps the parent mounted and marks it inert while the sub-page is up", () => {
    const { container, rerender } = renderShell();
    const page1 = container.querySelector('[data-page-id="1"]');
    const page2 = container.querySelector('[data-page-id="2"]');
    expect(page1.hasAttribute("inert")).toBe(false);
    expect(page1.getAttribute("aria-hidden")).toBeNull();
    expect(page2.hasAttribute("inert")).toBe(true);
    expect(page2.getAttribute("aria-hidden")).toBe("true");

    rerender(
      <ModalShell title="Parent" onClose={() => {}} maxWidth={440} stacked subPage={SUB_PAGE} onBack={() => {}}>
        <p>Parent content</p>
      </ModalShell>
    );
    // Both pages stay mounted during the push.
    expect(screen.getByText("Parent content")).toBeInTheDocument();
    expect(screen.getByText("Sub content")).toBeInTheDocument();
    // The inactive page is inert and aria-hidden; the active one is not.
    expect(page1.hasAttribute("inert")).toBe(true);
    expect(page1.getAttribute("aria-hidden")).toBe("true");
    expect(page2.hasAttribute("inert")).toBe(false);
    expect(page2.getAttribute("aria-hidden")).toBeNull();
    // The sub-page owns the header title.
    expect(screen.getByRole("heading").textContent).toBe("Sub page");
  });

  it("ignores subPage.maxWidth: the dialog keeps the shell maxWidth", () => {
    const { container, rerender } = renderShell();
    const dialog = container.querySelector("dialog");
    expect(dialog.style.maxWidth).toBe("440px");

    rerender(
      <ModalShell title="Parent" onClose={() => {}} maxWidth={440} stacked subPage={SUB_PAGE} onBack={() => {}}>
        <p>Parent content</p>
      </ModalShell>
    );
    expect(dialog.style.maxWidth).toBe("440px");
  });

  it("keeps the sub-page mounted through the short return transition", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = renderShell({ subPage: SUB_PAGE, onBack: () => {} });
      expect(screen.getByText("Sub content")).toBeInTheDocument();

      rerender(
        <ModalShell title="Parent" onClose={() => {}} maxWidth={440} stacked>
          <p>Parent content</p>
        </ModalShell>
      );
      // Just after Back, the outgoing page is still there to slide out.
      expect(screen.getByText("Sub content")).toBeInTheDocument();
      expect(screen.getByText("Parent content")).toBeInTheDocument();

      // After the slide window it unmounts.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByText("Sub content")).toBeNull();
      expect(screen.getByText("Parent content")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("the Back button calls onBack, not onClose", () => {
    const onBack = vi.fn();
    const onClose = vi.fn();
    renderShell({ subPage: SUB_PAGE, onBack, onClose });
    fireEvent.click(screen.getByRole("button", { name: "Back to Parent" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Escape returns from a sub-page first; a second Escape closes", () => {
    vi.useFakeTimers();
    try {
      const onBack = vi.fn();
      const onClose = vi.fn();
      const { container, rerender } = render(
        <ModalShell title="Parent" onClose={onClose} maxWidth={440} stacked subPage={SUB_PAGE} onBack={onBack}>
          <p>Parent content</p>
        </ModalShell>
      );
      const dialog = container.querySelector("dialog");

      fireEvent(dialog, new Event("cancel", { cancelable: true }));
      expect(onBack).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();

      // Back at the parent page, Escape closes the modal.
      rerender(
        <ModalShell title="Parent" onClose={onClose} maxWidth={440} stacked onBack={onBack}>
          <p>Parent content</p>
        </ModalShell>
      );
      fireEvent(dialog, new Event("cancel", { cancelable: true }));
      expect(onBack).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("the Close button closes the modal", () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      renderShell({ onClose });
      fireEvent.click(screen.getByRole("button", { name: "Close Parent" }));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

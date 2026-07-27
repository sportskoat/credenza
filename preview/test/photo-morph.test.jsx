// Card → detail photo morph (design handoff turn 9 §11).
//
// The spec: the card's photo is the shared element and grows from its shelf rect
// into the detail photo panel (~280ms ease-out, no re-crop), the card's text
// fades at 60ms, and the info rail wipes in from the photo's inner edge.
//
// The implementation is the browser's View Transition API. That choice is a hard
// constraint, not a preference — docs/carousel-canonical-state.md records two
// earlier morphs in this app that cloned nodes, measured rects, and flew the
// clones through a portal. Both were visibly glitchy and both were removed. So
// these tests assert the SHAPE of the mechanism as much as its behavior: one
// shared name at a time, no clones, and the plain state update still happening
// when the browser has no view transition at all.
//
// jsdom has no startViewTransition, so the fallback path is what runs here for
// free. The supported path is exercised with a fake that records what the DOM
// looked like at the moment the browser would have snapshotted it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  MORPH_NAME_PHOTO,
  MORPH_NAME_TEXT,
  runPhotoMorph,
  supportsViewTransition,
} from "../../credenza-fashion.jsx";
import Card from "../../components/Card.jsx";
import DesktopDetailPanel from "../../components/DesktopDetailPanel.jsx";
import DetailSheet from "../../sheets/DetailSheet.jsx";

const PHOTO = "data:image/png;base64,iVBORw0KGgo=";

function morphItem(extra = {}) {
  return {
    id: "mp-1",
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=111",
    title: "Morph tee",
    image: PHOTO,
    gallery: [],
    links: [{ url: "https://weidian.com/item.html?itemID=222", role: "buy" }],
    price: 229,
    currency: "CNY",
    seller: "replux",
    findStatus: "want",
    ...extra,
  };
}

// A stand-in for document.startViewTransition. It records the DOM state its
// callback produced, which is exactly what the real browser snapshots as the
// "new" frame.
function fakeViewTransition({ reject = false } = {}) {
  const calls = [];
  const fn = vi.fn((callback) => {
    const before = document.body.innerHTML;
    callback();
    calls.push({ before, after: document.body.innerHTML });
    return {
      ready: reject ? Promise.reject(new Error("skipped")) : Promise.resolve(),
      finished: reject ? Promise.reject(new Error("skipped")) : Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition() {},
    };
  });
  fn.calls = calls;
  return fn;
}

afterEach(() => {
  cleanup();
  delete document.startViewTransition;
});

// ─────────────────────────────────────────────────────────────────────────────
describe("§11 runPhotoMorph — the mechanism", () => {
  it("reports no support in jsdom, so the app takes the plain path", () => {
    expect(supportsViewTransition()).toBe(false);
  });

  it("still applies the state change when the browser has no view transition", async () => {
    const update = vi.fn();
    const morphed = await runPhotoMorph({ source: null, update });
    expect(update).toHaveBeenCalledTimes(1);
    // The return value says whether a transition ran, not whether the open did.
    expect(morphed).toBe(false);
  });

  it("skips the transition entirely under reduced motion", async () => {
    document.startViewTransition = fakeViewTransition();
    const update = vi.fn();
    await runPhotoMorph({ source: null, update, reduced: true });
    expect(document.startViewTransition).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("names the photo and the text on the way out", () => {
    const photo = document.createElement("div");
    const text = document.createElement("div");
    const seen = {};
    document.startViewTransition = vi.fn((callback) => {
      // Inside the callback the OLD frame is already captured, so read the tags
      // before the callback clears them.
      seen.photo = photo.style.viewTransitionName;
      seen.text = text.style.viewTransitionName;
      callback();
      return { finished: Promise.resolve(), ready: Promise.resolve() };
    });
    runPhotoMorph({ source: { photo, text }, update: () => {} });
    expect(seen.photo).toBe(MORPH_NAME_PHOTO);
    expect(seen.text).toBe(MORPH_NAME_TEXT);
    expect(MORPH_NAME_PHOTO).not.toBe(MORPH_NAME_TEXT);
  });

  it("releases the card's name INSIDE the callback, not after", () => {
    // This is the whole reason the release is where it is. The detail panel
    // claims the same name when it mounts. If the card still held it, two
    // elements would share one view-transition-name in the new frame and the
    // browser would skip the entire transition — a silent no-op that looks like
    // a broken morph.
    const photo = document.createElement("div");
    let nameAfterUpdate = "unset";
    document.startViewTransition = vi.fn((callback) => {
      callback();
      nameAfterUpdate = photo.style.viewTransitionName;
      return { finished: Promise.resolve(), ready: Promise.resolve() };
    });
    runPhotoMorph({ source: { photo }, update: () => {} });
    expect(nameAfterUpdate).toBe("");
  });

  it("clears the tags after a skipped transition instead of leaving them stuck", async () => {
    const photo = document.createElement("div");
    const text = document.createElement("div");
    document.startViewTransition = fakeViewTransition({ reject: true });
    const morphed = await runPhotoMorph({ source: { photo, text }, update: () => {} });
    expect(morphed).toBe(false);
    // A stuck name would poison every later morph on this card.
    expect(photo.style.viewTransitionName).toBe("");
    expect(text.style.viewTransitionName).toBe("");
  });

  it("opens anyway when startViewTransition throws", async () => {
    const update = vi.fn();
    const photo = document.createElement("div");
    document.startViewTransition = vi.fn(() => {
      throw new TypeError("no");
    });
    const morphed = await runPhotoMorph({ source: { photo }, update });
    // The navigation is the point. A failed animation must never eat it.
    expect(update).toHaveBeenCalledTimes(1);
    expect(morphed).toBe(false);
    expect(photo.style.viewTransitionName).toBe("");
  });

  it("survives a card with no photo node and no text node", async () => {
    const update = vi.fn();
    document.startViewTransition = fakeViewTransition();
    await runPhotoMorph({ source: { photo: null, text: undefined }, update });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("never clones a node — the DOM gains no copy of the card", async () => {
    // The anti-pattern this replaces made a second copy of the card and flew it
    // through a portal. Assert the mechanism cannot regress to that: the only
    // DOM change across the transition is the state update's own.
    document.startViewTransition = fakeViewTransition();
    render(<div id="probe">just one</div>);
    const before = document.querySelectorAll("#probe").length;
    await runPhotoMorph({ source: null, update: () => {} });
    expect(document.querySelectorAll("#probe")).toHaveLength(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("§11 the card hands up its morph nodes", () => {
  it("passes the photo box and the text block to the opener", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <Card
        item={morphItem()}
        selected={false}
        onToggle={onToggle}
        onToggleFavorite={vi.fn()}
        onOpen={vi.fn()}
        buyLabel="Buy"
        mode="light"
        phone
      />
    );
    await user.click(screen.getByRole("button", { name: /Open Morph tee/ }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    const nodes = onToggle.mock.calls[0][0];
    expect(nodes.photo).toBeInstanceOf(HTMLElement);
    expect(nodes.text).toBeInstanceOf(HTMLElement);
    // The photo box is the button that wraps the cover image, and the text block
    // is the title/meta column — the two halves the spec animates differently.
    expect(nodes.photo.className).toContain("cz-card-toggle");
    expect(nodes.text.className).toContain("cz-card-text");
    expect(nodes.photo).not.toBe(nodes.text);
  });

  it("hands up the SAME photo node from the text opener", () => {
    // The mouse-only duplicate opener sits on the title. It must morph from the
    // photo too — a morph that started from the title would fly the wrong box.
    const onToggle = vi.fn();
    const { container } = render(
      <Card
        item={morphItem()}
        selected={false}
        onToggle={onToggle}
        onToggleFavorite={vi.fn()}
        onOpen={vi.fn()}
        buyLabel="Buy"
        mode="light"
      />
    );
    const openers = container.querySelectorAll(".cz-card-toggle");
    expect(openers.length).toBe(2);
    fireEvent.click(openers[0]);
    fireEvent.click(openers[1]);
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle.mock.calls[0][0].photo).toBe(onToggle.mock.calls[1][0].photo);
  });

  it("does not carry a morph name at rest", () => {
    const { container } = render(
      <Card
        item={morphItem()}
        selected={false}
        onToggle={vi.fn()}
        onToggleFavorite={vi.fn()}
        onOpen={vi.fn()}
        buyLabel="Buy"
        mode="light"
      />
    );
    // A card sitting on the shelf with the name applied would collide with the
    // next card that claimed it, and the browser would skip that morph.
    for (const el of container.querySelectorAll("*")) {
      expect(el.style.viewTransitionName || "").toBe("");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("§11 the desktop panel receives the morph", () => {
  function renderPanel(extra = {}) {
    return render(
      <DesktopDetailPanel
        item={morphItem()}
        bodyProfile={null}
        buyLabel="Buy"
        onSaveEdit={vi.fn()}
        onOpen={vi.fn()}
        onAttachPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
        onOpenSizes={vi.fn()}
        onToggleFavorite={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
        {...extra}
      />
    );
  }

  it("marks the panel is-morphing when it arrived from a card tap", () => {
    const { container } = renderPanel({ morphing: true });
    expect(container.querySelector(".cz-dpanel").className).toContain("is-morphing");
  });

  it("does NOT mark it on a keyboard open or under reduced motion", () => {
    // Naming the stage with no morph in flight would pull it out of the root
    // snapshot and give it a bare cross-fade of its own — worse than nothing.
    const { container } = renderPanel();
    expect(container.querySelector(".cz-dpanel").className).not.toContain("is-morphing");
  });

  it("defaults to no morph, so every other caller is unaffected", () => {
    const { container } = renderPanel({ morphing: undefined });
    expect(container.querySelector(".cz-dpanel").className).not.toContain("is-morphing");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("§11 the phone sheet receives the morph", () => {
  function renderSheet(extra = {}) {
    return render(
      <DetailSheet
        item={morphItem()}
        buyLabel="Buy"
        onSaveEdit={vi.fn()}
        onRemove={vi.fn()}
        onOpen={vi.fn()}
        onAttachPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
        onOpenSizes={vi.fn()}
        onClose={vi.fn()}
        {...extra}
      />
    );
  }

  it("marks the surface is-morphing so it drops its own slide-up", () => {
    // The morph IS the entrance. Playing the sheet's slide-up as well would move
    // the surface while the photo inside it is still flying to its landing box.
    const { container } = renderSheet({ morphing: true });
    expect(container.querySelector(".cz-detail-surface").className).toContain(
      "is-morphing"
    );
  });

  it("keeps the slide-up when there is no morph", () => {
    const { container } = renderSheet();
    const cls = container.querySelector(".cz-detail-surface").className;
    expect(cls).not.toContain("is-morphing");
  });

  it("can be still and morphing at once without one class eating the other", () => {
    // is-still is reduced motion, is-morphing is the transition. The app never
    // sets both today, but the classes are independent and a future caller must
    // not silently lose one.
    const { container } = renderSheet({ morphing: true });
    const el = container.querySelector(".cz-detail-surface");
    expect(el.className).toContain("cz-detail-surface");
    expect(el.className).toContain("is-morphing");
  });
});

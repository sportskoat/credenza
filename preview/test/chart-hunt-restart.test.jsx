// #41 (Kyle 2026-08-07): "fix the Yupo card that cancels itself."
//
// A Yupoo album card never filled its FIT READ table. The read was starting
// and being cancelled about once a second, roughly twenty times, and finishing
// none. The cause was not the album and not the reader. Three of the hunt's
// inputs — the item, the save function, and the shelf list — were rebuilt on
// every render of the app, and the indexing bar renders the app about ten
// times a second. Each rebuild looked like a change, so the hunt restarted and
// aborted the read in flight. The album hunt is the slowest one, so it lost
// every race.
//
// This file pins the rule that fixes it: while the card stays open on the same
// item, a re-render must NOT start a second hunt and must NOT cancel the first.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const { huntMock } = vi.hoisted(() => ({ huntMock: vi.fn() }));

vi.mock("../../components/size-chart-hunt.js", async () => {
  const actual = await vi.importActual("../../components/size-chart-hunt.js");
  // Keep the real fingerprint and version. The hook reads both to decide
  // whether a hunt runs at all, and this file is about that decision.
  return { ...actual, huntSizeChart: huntMock };
});

const { default: DetailBody } = await import("../../components/DetailBody.jsx");

// The hook keeps a session list of item ids it already tried, so two tests
// that shared an id would skip the second hunt. Give every case its own.
let nextId = 0;

// A fresh object every call, exactly like the app: `items.find(...)` rebuilds
// the item, and the save function is a plain arrow rebuilt on every render.
function freshItem(id) {
  return {
    id,
    createdAt: 1753400000000,
    url: "https://mook-official.x.yupoo.com/albums/244505824?uid=1",
    title: "MOOK heavyweight tee",
    image: "https://photo.yupoo.com/mook-official/abc/medium.jpg",
    gallery: [
      "https://photo.yupoo.com/mook-official/one/medium.jpg",
      "https://photo.yupoo.com/mook-official/two/medium.jpg",
    ],
    seller: "mook",
    category: "shirt",
    findStatus: "want",
  };
}

function renderBody(id, extra = {}) {
  return render(
    <DetailBody
      item={freshItem(id)}
      bodyProfile={{ chest: "96", height: "180", weight: "75" }}
      buyLabel="Buy via Superbuy"
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      onOpenSizes={vi.fn()}
      onSaveEdit={vi.fn()}
      shelfItems={[freshItem(id)]}
      {...extra}
    />
  );
}

// Re-render the same card the way the app does: every prop object is new, and
// the save function is a new function. Nothing about the item has changed.
function rerenderLikeTheApp(rerender, id, extra = {}) {
  rerender(
    <DetailBody
      item={freshItem(id)}
      bodyProfile={{ chest: "96", height: "180", weight: "75" }}
      buyLabel="Buy via Superbuy"
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      onOpenSizes={vi.fn()}
      onSaveEdit={vi.fn()}
      shelfItems={[freshItem(id)]}
      {...extra}
    />
  );
}

beforeEach(() => {
  huntMock.mockReset();
});

afterEach(() => {
  cleanup();
  huntMock.mockReset();
});

describe("the open card does not cancel its own chart read", () => {
  it("starts one hunt, not one per render", async () => {
    nextId += 1;
    const id = "restart-" + nextId;
    // A read that takes real time, like the album hunt does.
    let finish;
    huntMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );

    const { rerender } = renderBody(id);
    await waitFor(() => expect(huntMock).toHaveBeenCalledTimes(1));

    // Ten renders of the app, the way the indexing bar drives them.
    for (let i = 0; i < 10; i += 1) rerenderLikeTheApp(rerender, id);

    expect(huntMock).toHaveBeenCalledTimes(1);
    finish({ text: "S 胸围 118\nM 胸围 122\nL 胸围 126" });
    await waitFor(() => expect(huntMock).toHaveBeenCalledTimes(1));
  });

  it("leaves the read in flight alone across those renders", async () => {
    nextId += 1;
    const id = "signal-" + nextId;
    let finish;
    huntMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );

    const { rerender } = renderBody(id);
    await waitFor(() => expect(huntMock).toHaveBeenCalledTimes(1));
    const { signal } = huntMock.mock.calls[0][1];
    expect(signal.aborted).toBe(false);

    for (let i = 0; i < 10; i += 1) rerenderLikeTheApp(rerender, id);

    // The proof of the bug: this signal used to be aborted by now, and a new
    // hunt used to be running in its place.
    expect(signal.aborted).toBe(false);
    finish(null);
  });

  it("shows the chart the hunt found", async () => {
    nextId += 1;
    const id = "arrives-" + nextId;
    let finish;
    huntMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );

    const saveEdit = vi.fn();
    const { rerender } = renderBody(id, { onSaveEdit: saveEdit });
    await waitFor(() => expect(huntMock).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 10; i += 1) rerenderLikeTheApp(rerender, id, { onSaveEdit: saveEdit });

    finish({ text: "S 胸围 118 衣长 71\nM 胸围 122 衣长 73\nL 胸围 126 衣长 75" });

    // The found chart reaches the item. Before the fix the read never got
    // this far: every render cancelled it first.
    await waitFor(() => expect(saveEdit).toHaveBeenCalled());
    const [savedId, patch] = saveEdit.mock.calls[0];
    expect(savedId).toBe(id);
    expect(patch.sizeChartText).toContain("胸围 126");
  });

  // The spinner must not outlive the read either. A card that keeps saying
  // "Looking for the seller's size chart…" after the answer arrives is the
  // same bug wearing different clothes.
  it("stops saying it is looking once the answer arrives", async () => {
    nextId += 1;
    const id = "spinner-" + nextId;
    let finish;
    huntMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );

    const { rerender } = renderBody(id);
    await waitFor(() => expect(huntMock).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 10; i += 1) rerenderLikeTheApp(rerender, id);

    finish(null);
    await waitFor(() =>
      expect(screen.queryByText(/Looking for the seller/)).toBe(null)
    );
  });
});

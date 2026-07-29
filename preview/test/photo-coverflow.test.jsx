// PhotoCoverFlow hardening: album rejection, image-prop clamp, optional cover.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PhotoCoverFlow from "../../components/PhotoCoverFlow.jsx";

const PHOTO_1 = "data:image/png;base64,AAA1";
const PHOTO_2 = "data:image/png;base64,AAA2";
const PHOTO_3 = "data:image/png;base64,AAA3";

function baseItem(extra = {}) {
  return {
    id: "pcf-1",
    title: "Cover Flow Shirt",
    url: "https://weidian.com/item.html?itemID=111",
    ...extra,
  };
}

function renderFlow(props = {}) {
  const onClose = props.onClose || vi.fn();
  return render(
    <PhotoCoverFlow
      item={props.item || baseItem()}
      images={props.images ?? [PHOTO_1, PHOTO_2, PHOTO_3]}
      startIndex={props.startIndex ?? 0}
      onClose={onClose}
      onSetPrimaryImage={props.onSetPrimaryImage}
      onRemovePhoto={props.onRemovePhoto}
      onLoadPhotos={props.onLoadPhotos}
    />
  );
}

afterEach(cleanup);

describe("PhotoCoverFlow hardening", () => {
  it("clears loading when album load rejects", async () => {
    let rejectLoad;
    const onLoadPhotos = vi.fn(
      () =>
        new Promise((_, reject) => {
          rejectLoad = reject;
        })
    );
    renderFlow({
      item: baseItem({
        id: "yupoo-1",
        url: "https://shop123.x.yupoo.com/albums/45678",
      }),
      images: [PHOTO_1],
      onLoadPhotos,
    });

    expect(await screen.findByText("Loading album…")).toBeInTheDocument();
    expect(onLoadPhotos).toHaveBeenCalled();

    await act(async () => {
      rejectLoad(new Error("relay failed"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Loading album…")).not.toBeInTheDocument();
    });
    // Still shows the seed photo after a failed album fetch.
    expect(screen.getByAltText("Album photo 1")).toBeInTheDocument();
  });

  it("clears loading when an item change aborts before the next item skips loading", async () => {
    let requestSignal;
    const onLoadPhotos = vi.fn(
      (_item, { signal }) =>
        new Promise((_, reject) => {
          requestSignal = signal;
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true }
          );
        })
    );
    const onClose = vi.fn();
    const { rerender } = render(
      <PhotoCoverFlow
        item={baseItem({
          id: "yupoo-pending",
          url: "https://shop123.x.yupoo.com/albums/45678",
        })}
        images={[PHOTO_1]}
        startIndex={0}
        onClose={onClose}
        onLoadPhotos={onLoadPhotos}
      />
    );

    expect(await screen.findByText("Loading album…")).toBeInTheDocument();

    rerender(
      <PhotoCoverFlow
        item={baseItem({ id: "regular-2", title: "Regular Shirt" })}
        images={[PHOTO_2]}
        startIndex={0}
        onClose={onClose}
        onLoadPhotos={onLoadPhotos}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText("Loading album…")).not.toBeInTheDocument();
    });
    expect(requestSignal.aborted).toBe(true);
    expect(onLoadPhotos).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Regular Shirt")).toBeInTheDocument();
  });

  it("syncs a shorter image list and clamps the active index", async () => {
    const item = baseItem();
    const onClose = vi.fn();
    const { rerender } = render(
      <PhotoCoverFlow
        item={item}
        images={[PHOTO_1, PHOTO_2, PHOTO_3]}
        startIndex={2}
        onClose={onClose}
      />
    );

    expect(await screen.findByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByAltText("Album photo 3")).toBeInTheDocument();

    rerender(
      <PhotoCoverFlow
        item={item}
        images={[PHOTO_1]}
        startIndex={2}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/\/ 3/)).not.toBeInTheDocument();
    });
    // Single photo: no counter, no crash, still the remaining image.
    expect(screen.getByAltText("Album photo 1")).toBeInTheDocument();
    expect(screen.queryByAltText("Album photo 3")).not.toBeInTheDocument();
    expect(screen.getByText("Cover Flow Shirt")).toBeInTheDocument();
  });

  it("hides Make cover photo when onSetPrimaryImage is omitted", async () => {
    renderFlow({ onSetPrimaryImage: undefined });
    await screen.findByRole("dialog", { name: "Album photo preview" });
    expect(screen.queryByRole("button", { name: "Make cover photo" })).not.toBeInTheDocument();
  });

  it("Make cover photo calls the optional callback when provided", async () => {
    const user = userEvent.setup();
    const onSetPrimaryImage = vi.fn();
    const onClose = vi.fn();
    renderFlow({ onSetPrimaryImage, onClose, startIndex: 1 });

    await screen.findByRole("dialog", { name: "Album photo preview" });
    await user.click(screen.getByRole("button", { name: "Make cover photo" }));
    expect(onSetPrimaryImage).toHaveBeenCalledWith("pcf-1", PHOTO_2);
    expect(onClose).toHaveBeenCalled();
  });

  it("hides Delete when onRemovePhoto is omitted", async () => {
    renderFlow({ onRemovePhoto: undefined });
    await screen.findByRole("dialog", { name: "Album photo preview" });
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("Delete asks first and removes the photo on screen", async () => {
    const user = userEvent.setup();
    const onRemovePhoto = vi.fn();
    const onClose = vi.fn();
    renderFlow({ onRemovePhoto, onClose, startIndex: 0 });

    await screen.findByRole("dialog", { name: "Album photo preview" });
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // The question replaces the two actions, so nothing is gone yet.
    expect(screen.getByText("Delete this photo?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument();
    expect(onRemovePhoto).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onRemovePhoto).toHaveBeenCalledWith("pcf-1", PHOTO_1);
    // Two photos are left, so the view stays open on the neighbour.
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("1 / 2")).toBeInTheDocument();
    });
  });

  it("Keep cancels the delete question", async () => {
    const user = userEvent.setup();
    const onRemovePhoto = vi.fn();
    renderFlow({ onRemovePhoto, onSetPrimaryImage: vi.fn() });

    await screen.findByRole("dialog", { name: "Album photo preview" });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Keep" }));

    expect(screen.queryByText("Delete this photo?")).not.toBeInTheDocument();
    expect(onRemovePhoto).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Make cover photo" })).toBeInTheDocument();
  });

  it("closes after the last photo is deleted", async () => {
    const user = userEvent.setup();
    const onRemovePhoto = vi.fn();
    const onClose = vi.fn();
    renderFlow({ images: [PHOTO_1], onRemovePhoto, onClose });

    await screen.findByRole("dialog", { name: "Album photo preview" });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onRemovePhoto).toHaveBeenCalledWith("pcf-1", PHOTO_1);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});

// Round 7 (2026-07-29): the magnifying glass on the full-screen photo.
describe("PhotoCoverFlow enlarged layer", () => {
  it("opens the enlarged layer from the active photo only", async () => {
    const user = userEvent.setup();
    renderFlow({ startIndex: 1 });

    await screen.findByRole("dialog", { name: "Album photo preview" });
    // One magnifier, and it belongs to the active photo (PHOTO_2).
    const buttons = screen.getAllByRole("button", { name: "Enlarge photo" });
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0]);

    const layer = await screen.findByRole("dialog", { name: "Enlarged photo" });
    expect(layer.querySelector("img").getAttribute("src")).toBe(PHOTO_2);
  });

  it("the exit button closes the layer but not the viewer", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderFlow({ onClose });

    await screen.findByRole("dialog", { name: "Album photo preview" });
    await user.click(screen.getByRole("button", { name: "Enlarge photo" }));
    await screen.findByRole("dialog", { name: "Enlarged photo" });

    await user.click(screen.getByRole("button", { name: "Close enlarged photo" }));
    expect(screen.queryByRole("dialog", { name: "Enlarged photo" })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Album photo preview" })).toBeInTheDocument();
  });

  it("Escape closes the layer first, then the viewer", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderFlow({ onClose });

    await screen.findByRole("dialog", { name: "Album photo preview" });
    await user.click(screen.getByRole("button", { name: "Enlarge photo" }));
    await screen.findByRole("dialog", { name: "Enlarged photo" });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Enlarged photo" })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("ignores the arrow keys while the layer is open", async () => {
    const user = userEvent.setup();
    renderFlow();

    await screen.findByRole("dialog", { name: "Album photo preview" });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enlarge photo" }));
    await screen.findByRole("dialog", { name: "Enlarged photo" });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("never offers the magnifier for a photo that failed to load", async () => {
    renderFlow();

    const img = await screen.findByAltText("Album photo 1");
    expect(screen.getByRole("button", { name: "Enlarge photo" })).toBeInTheDocument();
    fireEvent.error(img);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Enlarge photo" })).not.toBeInTheDocument();
    });
    // The neighbour photos still offer it when they become active.
  });
});

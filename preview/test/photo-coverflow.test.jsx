// PhotoCoverFlow hardening: album rejection, image-prop clamp, optional cover.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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

  it("hides Use as cover when onSetPrimaryImage is omitted", async () => {
    renderFlow({ onSetPrimaryImage: undefined });
    await screen.findByRole("dialog", { name: "Album photo preview" });
    expect(screen.queryByRole("button", { name: "Use as cover" })).not.toBeInTheDocument();
  });

  it("Use as cover calls the optional callback when provided", async () => {
    const user = userEvent.setup();
    const onSetPrimaryImage = vi.fn();
    const onClose = vi.fn();
    renderFlow({ onSetPrimaryImage, onClose, startIndex: 1 });

    await screen.findByRole("dialog", { name: "Album photo preview" });
    await user.click(screen.getByRole("button", { name: "Use as cover" }));
    expect(onSetPrimaryImage).toHaveBeenCalledWith("pcf-1", PHOTO_2);
    expect(onClose).toHaveBeenCalled();
  });
});

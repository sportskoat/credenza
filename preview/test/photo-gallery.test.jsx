// Full-screen photo album (components/PhotoCoverFlow.jsx) regression tests.
// Restored 2026-07-25 — Kyle: "the old photos where you could swipe through
// each photo… it was so good. Click on the photo to have that old scroll
// through carousel that had where you could set others as the cover photo."
// The trigger is the hero photo itself in the shared DetailBody; the album's
// "Use as cover" is the same explicit cover path as the hero action.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DetailBody from "../../components/DetailBody.jsx";

const PHOTO_1 = "data:image/png;base64,AAA1";
const PHOTO_2 = "data:image/png;base64,AAA2";
const PHOTO_3 = "data:image/png;base64,AAA3";

function albumItem() {
  return {
    id: "album-1",
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=111",
    title: "Celine Shirt 55or",
    image: PHOTO_1,
    gallery: [PHOTO_2, PHOTO_3],
    links: [{ url: "https://weidian.com/item.html?itemID=222", role: "buy" }],
    price: 229,
    currency: "CNY",
    seller: "replux",
    findStatus: "want",
  };
}

function renderBody(item, extra = {}) {
  return render(
    <DetailBody
      item={item}
      buyLabel="Buy via Superbuy"
      onSaveEdit={vi.fn()}
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      onOpenSizes={vi.fn()}
      heroPager
      {...extra}
    />
  );
}

afterEach(cleanup);

describe("Full-screen photo album", () => {
  it("opens at the tapped hero photo and pages with the chevrons", async () => {
    const user = userEvent.setup();
    renderBody(albumItem());
    // Every hero slide is a button — the photo itself is the trigger.
    await user.click(screen.getByRole("button", { name: "Open photo 2 full screen" }));
    const dialog = await screen.findByRole("dialog", { name: "Album photo preview" });
    expect(dialog.classList.contains("cz-photo-coverflow-backdrop")).toBe(true);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("Use as cover sets the active photo as the primary image and closes", async () => {
    const user = userEvent.setup();
    const onSetPrimaryImage = vi.fn();
    renderBody(albumItem(), { onSetPrimaryImage });
    await user.click(screen.getByRole("button", { name: "Open photo 1 full screen" }));
    await screen.findByRole("dialog", { name: "Album photo preview" });
    await user.click(screen.getByRole("button", { name: "Next photo" }));
    await user.click(screen.getByRole("button", { name: "Use as cover" }));
    expect(onSetPrimaryImage).toHaveBeenCalledWith("album-1", PHOTO_2);
    expect(screen.queryByRole("dialog", { name: "Album photo preview" })).not.toBeInTheDocument();
  });

  it("Escape closes the album", async () => {
    const user = userEvent.setup();
    renderBody(albumItem());
    await user.click(screen.getByRole("button", { name: "Open photo 1 full screen" }));
    await screen.findByRole("dialog", { name: "Album photo preview" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Album photo preview" })).not.toBeInTheDocument();
  });

  it("the close button closes the album", async () => {
    const user = userEvent.setup();
    renderBody(albumItem());
    await user.click(screen.getByRole("button", { name: "Open photo 1 full screen" }));
    await screen.findByRole("dialog", { name: "Album photo preview" });
    await user.click(screen.getByRole("button", { name: "Close photo preview" }));
    expect(screen.queryByRole("dialog", { name: "Album photo preview" })).not.toBeInTheDocument();
  });
});

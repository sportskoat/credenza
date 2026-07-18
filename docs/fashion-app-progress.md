# Credenza Fashion App — Implementation Progress Log

**Session:** 2026-07-17  
**Working on:** Tasks 1–3 from project brief — exotic visual redesign + carousel polish.

---

## Done so far

### Header / tabs cleanup
- Removed redundant "The shelf" heading.
- Replaced opaque pill tabs with underline-style tabs.
- File: `credenza-fashion.jsx`.

### Carousel behavior
- Restored card overlap (user wants cards close together).
- Added `isCenter` prop to `CarouselCard`.
- Clicking a **side card** now smoothly scrolls it to center.
- Clicking the **center card** flips it.
- Softened the 3D rotation/opacity so transitions feel smoother and side cards stay readable.
- Files: `credenza-fashion.jsx`, `credenza-fashion.css`.

### Back-of-card layout
- Centered action buttons in a 2-column grid.
- Increased button padding for better touch targets.
- File: `credenza-fashion.css`.

---

## Done (continued)

### Holographic interactive background
- Added `HolographicBackground` React component in `credenza-fashion.jsx`.
- Tracks mouse/touch position with requestAnimationFrame lerping.
- Renders multi-layer radial gradients (magenta, cyan, tangerine, violet) with `screen` blend mode and heavy blur.
- Placed behind app shell (`z-index: 0`).

### Exotic color palette
- Shifted dark/light themes from red/orange to holographic violet/pink/cyan.
- New variables: deep violet-black background, hot-pink accent (`#ff2ec7`), cyan secondary (`#00f0ff`), pink→cyan action gradient.
- Updated ambient glow orbs and carousel gradient borders to match.

### Visual verification
- Grid view shows gradient background and pink/cyan buttons.
- Carousel view renders with new palette; overlap preserved.

---

## Still to do / next

1. Dial in holographic background intensity so text stays crisp everywhere.
2. Verify carousel side-click navigation and center-click flip end-to-end.
3. Refine back-of-card layout and reduce empty space further.
4. Smooth out any remaining flip glitches.
5. Decide if cards need more styling refresh (borders, shadows, typography).

---

## Notes

- Fashion mode is launched with `VITE_CREDENZA_FASHION=true npm run dev`.
- Dev server runs on `http://localhost:5173/`.
- When context gets near the limit, this file captures state so work can resume.
- Screenshots saved locally: `/tmp/fashion-viz-grid.png`, `/tmp/fashion-viz-carousel.png`.

---

## Session update — 2026-07-18

### Fashion-default launch
- Normal `npm run dev` and `npm run build` now use the Fashion entry; generic mode remains available as `dev:generic` / `build:generic`.
- Fresh launch always starts in carousel mode while retaining saved sort and theme preferences.
- Fashion builds publish a root `index.html` shell and precache both Fashion shell paths.

### Carousel stabilization
- Replaced transformed `getBoundingClientRect()` measurements with layout `offsetLeft` / `offsetWidth` geometry.
- Added one exact-center scroll path, stable foreground ownership with midpoint hysteresis, deterministic z-order ties, and selection synchronization.
- Trackpad wheel input temporarily suspends CSS snap and cancels stale smooth scrolling, then performs one settle after the gesture; bidirectional slow-wheel verification showed monotonic `0→1→2→3` and `3→2→1→0` handoffs.
- Touch remains native; mouse/pen drag uses thresholded Pointer Events and pointer capture.
- Whole-card opacity fading was removed. Moving cards keep opacity `1`, use a side scrim, and temporarily simplify backdrop/mask compositing.
- Side-card click centers without flipping; a second click on the settled center card flips.

### Yupoo + Weidian enrichment
- Yupoo function now extracts canonical album ID/URL, title/code, seller/account, price, batch, description, buy link, and eight distinct product assets.
- Excludes Yupoo UI logos, collapses small/medium/big variants by asset identity, and prefers the best observed image variant.
- Supplied album resolves to `¥229`, `M32126-109E`, `Mook-offcical`, Weidian item `7799763843`, and eight product photos.
- Hotlink-protected Yupoo photos are relayed with the album Referer, compressed, and persisted locally.
- Quick stash, paste import, share capture, and browser-tab capture now use the shared guarded enrichment pipeline with bounded bulk concurrency.
- Yupoo and Weidian canonical keys prevent query/tracking duplicates; duplicate pastes refresh existing cards.

### Fashion data + photo experience
- Migration preserves remote covers/galleries, poster size, recommended size, variants, size notes, and legacy `weidianUrl` buy links.
- Quota recovery prunes embedded `data:image/...` covers only, never remote URLs.
- Buy is the single dominant card action; Photos, Sizes, Seller, Agent, Edit, and Remove remain secondary.
- Sizes displays selected/poster/recommended sizes, size run, resolver notes, and variant axes without inventing measurements.
- Photo spread is now a sibling overlay around the settled card, responsive down to 320px, with up to eight images, in-app preview, previous/next controls, and explicit **Use as cover**.

### Verification
- `npm test`: 56 passing tests across 7 files.
- `npm run typecheck`: pass.
- `npm run build` and `npm run build:generic`: pass.
- `npm run lint`: 0 errors; existing repository warnings remain.
- Netlify Dev real-app import verified the supplied Yupoo URL with a useful cover, 7 gallery images (8 total including cover), correct price/seller/batch/buy URL, responsive orbit, and no browser console errors.
- Verification screenshots: `/tmp/credenza-yupoo-card.png`, `/tmp/credenza-yupoo-orbit.png`, `/tmp/credenza-yupoo-preview.png`, `/tmp/credenza-yupoo-orbit-320.png`, `/tmp/credenza-carousel-samples.png`.

# Design components and their repo counterparts

The Design project ships 22 components. The repo does not import them. A design
file cannot be pasted into the repo — the prop shapes differ. Translate, do not copy.

## The 22 Design components

BrandLockup · BrandMark · Button · BuyButton · Caption · Chip · Field · HaulBar ·
IconButton · Kicker · MastheadLink · ModalShell · PriceChip · ProductCard ·
SearchField · SegmentedOption · SizeChartTable · SizeRecommendation · StatusPill ·
StatusTrack · Toast · ViewTab

Enum props are checked by the adherence rules: `variant`, `tone`, `role`, `type`.
Do not invent a new value for one of those. Add it to the Design project first.

## ProductCard is the one that matters

Design `components/shelf/ProductCard.jsx` takes 16 props.
Repo `components/Card.jsx` takes 10 props. Only 3 names overlap.

| Design prop     | Repo equivalent            | Note                                     |
| --------------- | -------------------------- | ---------------------------------------- |
| `image`         | `item.image`               | Repo reads from the item object.         |
| `title`         | `item.title`               | Same.                                    |
| `price`         | `item.price`               | Same.                                    |
| `seller`        | `item.seller`              | Same.                                    |
| `href`          | `item.url`                 | Same.                                    |
| `status`        | `item.status`              | Feeds `StatusPill`.                      |
| `favorited`     | `item.favorite`            | Boolean.                                 |
| `onFavorite`    | `onToggleFavorite`         | Renamed.                                 |
| `selected`      | `selected`                 | Direct match.                            |
| `onSelect`      | `onToggle`                 | Renamed.                                 |
| `onOpen`        | `onOpen`                   | Direct match.                            |
| `buyLabel`      | `buyLabel`                 | Direct match.                            |
| `albumHref`     | `item.album`               | Feeds `AlbumLink`.                       |
| `sizeLive`      | derived from `fitPrefs`    | Repo computes it. Do not pass it in.     |
| `dense`         | `mode`                     | Repo uses a mode string, not a boolean.  |
| `compact`       | `phone`                    | Repo names the phone layout explicitly.  |
| —               | `bodyProfile`              | Repo only. Not in the Design component.  |

## What Design does not have

- `CoverFlowCarousel` and its physics. Never recreate it. See `docs/carousel-canonical-state.md`.
- The photo-morph view transition. The repo does it with `photoRef` and `textRef`.
- No Figma source exists. The Design project is the source.

## How to use a Design component in the repo

1. Read the Design source and its `.prompt.md` sibling.
2. Keep the visual rules: token names, radii, spacing, hover behaviour.
3. Map the props to the repo shape using the table above.
4. Never copy a raw hex or a raw px across. Use the token.

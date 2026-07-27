// LB-11. framer-motion's feature bundle is the expensive half of the library.
// Loading it through LazyMotion moves it out of the entry chunk and into a
// chunk the browser fetches after the first paint.
//
// Two constraints decided the shape of this:
//
// 1. It must be `domMax`, not `domAnimation`. The carousel and the photo
//    cover flow both use `onPan`, and pan lives in the drag feature bundle.
//    `domAnimation` drops it, which would kill both swipe gestures.
//    Measured: `domMax` loaded eagerly saves nothing at all (it is 164 bytes
//    LARGER than plain `motion`). The whole win comes from loading it late.
//
// 2. Every file must import `m`, not `motion`. One leftover `motion` import
//    pulls the features back into the entry chunk and the split disappears.
//    `LazyMotion strict` turns that mistake into a thrown error instead of a
//    silent size regression, so keep `strict` on.
//
// `vite.config.js` must also keep "framer-motion" OUT of the `vendor`
// manualChunks list. Naming it there forces the whole library into one eager
// chunk and defeats this file completely.
export const loadMotionFeatures = () =>
  import("framer-motion").then((mod) => mod.domMax);

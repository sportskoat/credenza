// The app's masthead navigation (Kyle 2026-07-27: "we should probably just
// make a header that links to all of our pages here… make it easy to navigate…
// make a few header pages that link out to pro, contact us, guides, etc.").
//
// Before this, the desktop masthead was a brand mark on the left, an empty
// middle, and one avatar button on the right. The site had 24 pages and the
// product linked to four of them, buried under the data rows of the Profile
// sheet (LB-50). A person in the app could not get to Pricing without opening
// a modal first.
//
// One list, two renderers. The header reads it, and preview/test/app-site-nav
// .test.js reads it back out of this file to prove every href is a directory
// with an index.html under preview/public. The app is a bundle and the site is
// static HTML served by the same host, so nothing in the JSX can tell you
// whether /guides/ resolves — only the filesystem can.
//
// Order is the order of the questions somebody asks: what does this do, how do
// I do the thing, what does it cost, what if I get stuck, who do I talk to.
//
// No counts in any label. "13 guides" goes stale the next time a guide ships,
// in a file nobody edits when they add a page.
export const SITE_NAV = [
  { href: "/how/", label: "How it works" },
  { href: "/guides/", label: "Guides" },
  // "Pricing", not "Pro" (Kyle 2026-07-29, Fable's ruling). The app header
  // said Pro and every static page said Pricing, so the same destination had
  // two names depending on which page you were standing on. The label names
  // what the page shows; "Pro" names the plan the page sells.
  { href: "/pricing/", label: "Pricing" },
  { href: "/faq/", label: "FAQ" },
  { href: "/support/", label: "Support" },
  { href: "/contact/", label: "Contact" },
];

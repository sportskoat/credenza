import SettingsSection from "./SettingsSection.jsx";

// About and support (design: one of the six sections). The app's route out
// to the site. Ordered by what a person in the product actually wants next:
// what does this do, how do I do the thing, what does it cost, and who do I
// ask. Keep it to four — a long list turns the section into a sitemap.
//
// The test at test/app-site-nav.test.js asserts every href here is a
// directory with an index.html under preview/public. A typo here is a 404 in
// the one place a confused person goes.
//
// No counts in the value column. "13 walkthroughs" was the first draft, and
// a number here goes stale the next time a guide ships — in a file nobody
// edits when they add a page.
//
// Kyle 2026-07-29: "make sure that these pages do not go to a separate window
// and we stay in this tab". They are our own pages, so they open in place now.
// The cost he accepted: these are real navigations out of a single-page app,
// so an open sheet closes and Back is the way home. Links that LEAVE Credenza
// — a seller listing, a photo album — still open a new tab, because losing the
// shelf behind a seller page is a worse trade.
export const SITE_LINKS = [
  ["/how/", "How it works", "The shelf"],
  ["/guides/", "Guides", "Walkthroughs"],
  ["/pricing/", "Plans", "Free & Pro"],
  ["/support/", "Support", "Cancel, refund, bug"],
];

export default function AboutSupportSection() {
  return (
    <SettingsSection
      kicker="About"
      title="About and support"
      lead="Credenza is a save-it-later shelf for fashion finds. These are the ways to learn it and the ways to reach us."
    >
      <div className="cz-profile-label">Learn</div>
      <div className="cz-profile-group">
        {SITE_LINKS.map(([href, label, val]) => (
          <a
            key={href}
            className="cz-profile-row cz-profile-row-link"
            href={href}
          >
            <span>{label}</span>
            {/* The ↗ arrow promised a new tab. The link stays in this tab now,
                so the arrow would be a lie. */}
            <span className="cz-profile-row-val">{val}</span>
          </a>
        ))}
      </div>
      <div className="cz-profile-legal">
        <a className="cz-profile-legal-link" href="/privacy/">
          Privacy
        </a>
        <a className="cz-profile-legal-link" href="/terms/">
          Terms
        </a>
        <a className="cz-profile-legal-link" href="mailto:wenselllc@gmail.com">
          Email us
        </a>
      </div>
    </SettingsSection>
  );
}

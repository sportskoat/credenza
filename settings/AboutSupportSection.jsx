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
// These are real navigations out of a single-page app, so they open in a new
// tab. A same-tab jump would drop an unsaved sheet and make Back the only
// way home.
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
            target="_blank"
            rel="noreferrer"
          >
            <span>{label}</span>
            <span className="cz-profile-row-val">{val} ↗</span>
          </a>
        ))}
      </div>
      <div className="cz-profile-legal">
        <a className="cz-profile-legal-link" href="/privacy/" target="_blank" rel="noreferrer">
          Privacy
        </a>
        <a className="cz-profile-legal-link" href="/terms/" target="_blank" rel="noreferrer">
          Terms
        </a>
        <a className="cz-profile-legal-link" href="mailto:wenselllc@gmail.com">
          Email us
        </a>
      </div>
    </SettingsSection>
  );
}

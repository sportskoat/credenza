import SettingsSection from "./SettingsSection.jsx";

// About and support. Href list is asserted by test/app-site-nav.test.js.
export const SITE_LINKS = [
  ["/how/", "How it works", "The shelf"],
  ["/guides/", "Guides", "Walkthroughs"],
  ["/pricing/", "Pricing", "Free & Pro"],
  ["/support/", "Support", "Cancel, refund, bug"],
];

export default function AboutSupportSection() {
  return (
    <SettingsSection
      kicker="ABOUT"
      title="About and support."
      lead="Credenza is a save-it-later shelf for fashion finds. These are the ways to learn it and the ways to reach us."
      sectionId="about"
    >
      <div className="cz-settings-card cz-settings-rows">
        {SITE_LINKS.map(([href, label, val]) => (
          <a key={href} className="cz-settings-row-btn cz-settings-row-link" href={href}>
            <span className="cz-settings-row-name">{label}</span>
            <span className="cz-settings-row-meta">{val}</span>
          </a>
        ))}
      </div>
      <div className="cz-settings-about-footer">
        <a className="cz-settings-about-link" href="/privacy/">
          Privacy
        </a>
        <a className="cz-settings-about-link" href="/terms/">
          Terms
        </a>
        <a className="cz-settings-about-link" href="mailto:wenselllc@gmail.com">
          Email us
        </a>
        <span className="cz-settings-about-ver">v2.4.0 · LOCAL</span>
      </div>
    </SettingsSection>
  );
}

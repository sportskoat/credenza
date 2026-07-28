// SettingsSection: the right-pane wrapper every section renders inside.
// One kicker, one title, one lead line, then the section body. Keeping the
// chrome here means the six sections stay comparable and the page owns the
// rhythm, not each section.
export default function SettingsSection({ kicker, title, lead, children }) {
  return (
    <section className="cz-settings-section">
      {kicker ? <div className="cz-settings-section-kicker">{kicker}</div> : null}
      <h1 className="cz-settings-section-head">{title}</h1>
      {lead ? <p className="cz-settings-section-lead">{lead}</p> : null}
      {children}
    </section>
  );
}

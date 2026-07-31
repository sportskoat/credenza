// SettingsSection: the right-pane wrapper every section renders inside.
// One kicker, one title, one lead line, then the section body. Keeping the
// chrome here means the six sections stay comparable and the page owns the
// rhythm, not each section.
//
// `wide` lifts the 640px column for sections that need a photo + fields split
// (Sizes and measurements v2). Other sections stay centered at 640.
export default function SettingsSection({ kicker, title, lead, children, wide = false }) {
  return (
    <section className={"cz-settings-section" + (wide ? " is-wide" : "")}>
      {kicker ? <div className="cz-settings-section-kicker">{kicker}</div> : null}
      <h1 className="cz-settings-section-head">{title}</h1>
      {lead ? <p className="cz-settings-section-lead">{lead}</p> : null}
      {children}
    </section>
  );
}

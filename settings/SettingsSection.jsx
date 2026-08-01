// Section chrome for the one-page settings scroller. `sectionId` is the
// scroll-spy target (matches SETTINGS_SECTIONS keys). `wide` lifts the max
// width for Sizes (diagram + fields side by side).
export default function SettingsSection({
  kicker,
  title,
  lead,
  children,
  wide = false,
  sectionId,
}) {
  return (
    <section
      className={"cz-settings-section" + (wide ? " is-wide" : "")}
      id={sectionId ? "settings-" + sectionId : undefined}
      data-settings-section={sectionId || undefined}
    >
      {kicker ? <div className="cz-settings-section-kicker">{kicker}</div> : null}
      <h2 className="cz-settings-section-head">{title}</h2>
      {lead ? <p className="cz-settings-section-lead">{lead}</p> : null}
      {children}
    </section>
  );
}

import { useSettings } from "./SettingsContext.jsx";
import SettingsSection from "./SettingsSection.jsx";

// Shelf defaults (Profile Settings design 1e). These four used to be rows in
// the settings sheets; each moved next to the thing it changes. The design
// made this section read-only — Kyle overrode that (2026-07-28: "you can't
// toggle any of those on or off"). Every row works here AND on the shelf;
// the small line under a value still names the shelf surface, because two
// places to flip one switch needs the map.
export default function ShelfDefaultsSection() {
  const {
    agentLabel,
    pricePrimary,
    fitSummary,
    fitDetail,
    onOpenAgent,
    onCycleCurrency,
    onToggleFitSummary,
    onCycleFitDetail,
  } = useSettings();
  const rows = [
    ["Default agent", agentLabel || "None picked", "Also on any Buy button. Your pick sticks.", onOpenAgent],
    ["Primary currency", pricePrimary, "Also the currency chip on the shelf total.", onCycleCurrency],
    ["Fit summary", fitSummary ? "On" : "Off", "Also the size paragraph of any card.", onToggleFitSummary],
    [
      "Fit detail",
      fitDetail === "detailed" ? "Detailed" : "Concise",
      "Also the chip next to the fit summary.",
      onCycleFitDetail,
    ],
  ];
  return (
    <SettingsSection
      kicker="Shelf"
      title="Shelf defaults"
      lead="Every row works. The same switches also live on the shelf, next to the thing they change."
    >
      <div className="cz-profile-group">
        {rows.map(([label, value, where, onClick]) => (
          <button type="button" className="cz-profile-row" key={label} onClick={onClick}>
            <span>{label}</span>
            <span className="cz-profile-row-val">{value}</span>
            <span className="cz-shelf-defaults-where">{where}</span>
          </button>
        ))}
      </div>
    </SettingsSection>
  );
}

import { useSettings } from "./SettingsContext.jsx";
import SettingsSection from "./SettingsSection.jsx";

// Shelf defaults — same four switches, hairline card recipe (handoff §4).
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
      kicker="SHELF"
      title="Shelf defaults."
      lead="Every row works. The same switches also live on the shelf, next to the thing they change."
      sectionId="shelf"
    >
      <div className="cz-settings-card cz-settings-rows">
        {rows.map(([label, value, where, onClick]) => (
          <button type="button" className="cz-settings-row-btn" key={label} onClick={onClick}>
            <span className="cz-settings-row-main">
              <span className="cz-settings-row-name">{label}</span>
              <span className="cz-settings-row-note">{where}</span>
            </span>
            <span className="cz-settings-row-chip">{value}</span>
          </button>
        ))}
      </div>
    </SettingsSection>
  );
}

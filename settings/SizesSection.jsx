import { Suspense, lazy } from "react";
import { useSettings } from "./SettingsContext.jsx";
import SettingsSection from "./SettingsSection.jsx";

// Lazy, same as in the app root: the measurement editor is a big form and is
// only needed when this section is open.
const BodyProfileSheet = lazy(() => import("../sheets/BodyProfileSheet.jsx"));

// Sizes and measurements (design: one of the six sections). The same editor
// the old profile sub-page embedded — the routed page owns the chrome now.
export default function SizesSection() {
  const { bodyProfile, measureUnits, onSaveBodyProfile, onChangeUnits } = useSettings();
  // Wide section: photo left + fields right needs ~1080px, not the 640 default.
  return (
    <SettingsSection
      kicker="Sizes"
      title="Sizes and measurements."
      lead="Every size Credenza suggests starts here. None of it is required, and the card always says which part it leaned on."
      wide
    >
      <Suspense fallback={null}>
        <BodyProfileSheet
          value={bodyProfile}
          units={measureUnits}
          onSave={onSaveBodyProfile}
          onChangeUnits={onChangeUnits}
          onClose={() => {}}
          embedded
        />
      </Suspense>
    </SettingsSection>
  );
}

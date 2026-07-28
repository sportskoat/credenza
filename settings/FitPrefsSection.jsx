import { Suspense, lazy } from "react";
import { FIT_PREF_AXES } from "../credenza-fashion.jsx";
import { useSettings } from "./SettingsContext.jsx";
import SettingsSection from "./SettingsSection.jsx";

const FitPrefsSheet = lazy(() => import("../sheets/FitPrefsSheet.jsx"));

// Fit preferences (design: one of the six sections). Length and looseness per
// category — the same editor the old sheet stack embedded.
//
// Kyle 2026-07-28: "it doesn't give you the full preference list here." The
// old version gated the list to categories already on the shelf, so a reader
// with only shirts stashed could never set a pants preference until they
// bought pants. Settings is where you plan — it lists every category
// Credenza can read, owned or not.
const ALL_CATEGORIES = Object.keys(FIT_PREF_AXES);

export default function FitPrefsSection() {
  const { fitPrefs, onSaveFitPrefs } = useSettings();
  return (
    <SettingsSection
      kicker="Fit"
      title="Fit preferences"
      lead="How you like each category to sit. Credenza reads these when it picks a size."
    >
      <Suspense fallback={null}>
        <FitPrefsSheet
          value={fitPrefs}
          ownedCategories={ALL_CATEGORIES}
          onSave={onSaveFitPrefs}
          onClose={() => {}}
          embedded
        />
      </Suspense>
    </SettingsSection>
  );
}

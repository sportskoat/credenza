import { createContext, useContext } from "react";

// SettingsContext carries every handler and value the settings sections
// need, from the app root to the section bodies. Without it, SettingsPage
// would forward thirty props into six sections, and credenza-fashion.jsx —
// the file every agent edits — would grow a prop line per section per phase.
//
// The provider value is assembled once in credenza-fashion.jsx. Sections
// read only the keys they use.
const SettingsContext = createContext(null);

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must run inside SettingsContext.Provider");
  return value;
}

export default SettingsContext;

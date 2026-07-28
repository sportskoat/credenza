import { Suspense, lazy } from "react";
import { useSettings } from "./SettingsContext.jsx";
import SettingsSection from "./SettingsSection.jsx";

// Lazy, same as in the app root: the import editor and the shared-links
// manager are heavy and only needed when this section is open.
const ImportSheet = lazy(() => import("../sheets/ImportSheet.jsx"));
const SharedLinksSheet = lazy(() => import("../sheets/SharedLinksSheet.jsx"));

// Your data (design: one of the six sections). Import and backup, shared
// links, storage, and the erase switch — the things that touch what you
// saved. The rows reuse the profile-sheet classes so the surface reads the
// same as the sheet it replaces.
export default function YourDataSection() {
  const {
    items,
    onImport,
    onExport,
    onExportCsv,
    isPro,
    onClearShelf,
    onRestore,
    storageLabel,
    storageColor,
    onEraseData,
    sharedLinks,
    accountEnabled,
    accountSession,
  } = useSettings();

  const signedIn = accountEnabled && !!accountSession;

  return (
    <SettingsSection
      kicker="Your data"
      title="Your data"
      lead="Your shelf lives on this device. These are the ways in, the ways out, and the way to start over."
    >
      <div className="cz-profile-label">Import &amp; backup</div>
      <div className="cz-profile-group cz-settings-data-import">
        <Suspense fallback={null}>
          <ImportSheet
            items={items}
            onImport={onImport}
            onClose={() => {}}
            onExport={onExport}
            onExportCsv={onExportCsv}
            isPro={isPro}
            onClearShelf={onClearShelf}
            onRestore={onRestore}
            embedded
          />
        </Suspense>
      </div>

      {/* LB-8. Signed in only: the links live on the server, so a signed-out
          person has none and the block would be an empty page. */}
      {signedIn && sharedLinks ? (
        <>
          <div className="cz-profile-label">Shared links</div>
          <div className="cz-profile-group">
            <Suspense fallback={null}>
              <SharedLinksSheet
                onList={sharedLinks.onList}
                onDelete={sharedLinks.onDelete}
                onCopy={sharedLinks.onCopy}
                onClose={() => {}}
                embedded
              />
            </Suspense>
          </div>
        </>
      ) : null}

      <div className="cz-profile-label">On this device</div>
      <div className="cz-profile-group">
        <div className="cz-profile-row is-static">
          <span>Storage</span>
          <span className="cz-profile-row-val cz-profile-storage">
            <span
              className="cz-profile-storage-dot"
              style={{ background: storageColor }}
              aria-hidden="true"
            />
            {storageLabel}
          </span>
        </div>
        <button type="button" className="cz-profile-row cz-profile-danger" onClick={onEraseData}>
          <span>Erase my data</span>
          <span className="cz-profile-row-val">Deletes everything ›</span>
        </button>
      </div>
    </SettingsSection>
  );
}

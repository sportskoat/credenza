import { Suspense, lazy } from "react";
import { useSettings } from "./SettingsContext.jsx";
import SettingsSection from "./SettingsSection.jsx";

const ImportSheet = lazy(() => import("../sheets/ImportSheet.jsx"));
const SharedLinksSheet = lazy(() => import("../sheets/SharedLinksSheet.jsx"));

// Your data — import, backup, shared links, erase (handoff §5).
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
  const count = Array.isArray(items) ? items.length : 0;

  return (
    <SettingsSection
      kicker="YOUR DATA"
      title="Your data."
      lead="Your shelf lives on this device. These are the ways in, the ways out, and the way to start over."
      sectionId="data"
    >
      <div className="cz-settings-data-grid">
        <div className="cz-settings-card cz-settings-data-import">
          <div className="cz-settings-card-label">IMPORT</div>
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

        <div className="cz-settings-card cz-settings-rows">
          <div className="cz-settings-card-label cz-settings-card-label-pad">OUT</div>
          <button type="button" className="cz-settings-row-btn" onClick={onExport}>
            <span className="cz-settings-row-name">Download your shelf as a .json backup</span>
            <span className="cz-settings-row-meta">{count} ITEMS</span>
          </button>
          <button
            type="button"
            className="cz-settings-row-btn"
            onClick={isPro ? onExportCsv : undefined}
            disabled={!isPro}
            title={!isPro ? "Pro unlocks CSV export." : undefined}
          >
            <span className="cz-settings-row-name">Export a .csv for Numbers, Excel or Sheets</span>
            <span className="cz-settings-row-meta">{count} ROWS</span>
          </button>
          {signedIn && sharedLinks ? (
            <div className="cz-settings-data-shared">
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
          ) : (
            <div className="cz-settings-row-btn is-static">
              <span className="cz-settings-row-name">Shared links</span>
              <span className="cz-settings-row-meta">SIGN IN</span>
            </div>
          )}
          <button type="button" className="cz-settings-row-btn is-danger" onClick={onClearShelf}>
            <span className="cz-settings-row-name">Clear the whole shelf…</span>
            <span className="cz-settings-row-meta">CANNOT BE UNDONE</span>
          </button>
        </div>
      </div>

      <div className="cz-settings-card cz-settings-rows" style={{ marginTop: 14 }}>
        <div className="cz-settings-row-btn is-static">
          <span className="cz-settings-row-name">Storage</span>
          <span className="cz-settings-row-meta cz-profile-storage">
            <span
              className="cz-profile-storage-dot"
              style={{ background: storageColor }}
              aria-hidden="true"
            />
            {storageLabel}
          </span>
        </div>
        <button type="button" className="cz-settings-row-btn is-danger" onClick={onEraseData}>
          <span className="cz-settings-row-name">Erase my data</span>
          <span className="cz-settings-row-meta">Deletes everything</span>
        </button>
      </div>
    </SettingsSection>
  );
}

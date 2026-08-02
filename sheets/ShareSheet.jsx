import { useState } from "react";
import { ModalShell, PRICING } from "../credenza-fashion.jsx";
import { Pill } from "../components/atoms.jsx";
import {
  SHARE_FIELDS,
  DEFAULT_SHARE_FIELDS,
  SHARE_EXPIRY_DAYS,
  SHARE_MAX_ITEMS,
} from "../credenza-share.js";

// Share a haul (LB-8). The sheet is a preview of a decision, not a form: every
// row says what the reader of the link will see, and nothing is on by default
// except the photos and the titles.
//
// The order of the two halves is deliberate. The toggles come first because
// they change what the link contains; the Pro options come second because they
// change how the link behaves. A person who taps "Create link" without reading
// either gets the safe share.
//
// This component holds the draft and nothing else. `onCreate` does the network
// call, because the sheet must not know about tokens.

const FIELD_ROWS = [
  { key: "prices", label: "Prices", on: "Each card shows what you paid.", off: "No prices anywhere." },
  { key: "notes", label: "Your notes", on: "Your own notes appear under each card.", off: "Notes stay private." },
  { key: "quality", label: "QC and batch", on: "Batch name and how many QC photos you have.", off: "No QC details. Your QC photos are never shared." },
  { key: "sellers", label: "Sellers", on: "The seller name on each card.", off: "No seller names." },
  { key: "parcel", label: "Weights", on: "The weight of each item.", off: "No weights." },
];

const EXPIRY_LABELS = { 1: "1 day", 7: "7 days", 30: "30 days" };

function expiryLabel(days) {
  return days == null ? "Never" : EXPIRY_LABELS[days] || days + " days";
}

export default function ShareSheet({
  haulName,
  itemCount,
  isPro = false,
  signedIn = false,
  onCreate,
  onCopy,
  onUpgrade,
  onClose,
}) {
  const [fields, setFields] = useState(() => ({ ...DEFAULT_SHARE_FIELDS }));
  const [unlisted, setUnlisted] = useState(false);
  const [hideFooter, setHideFooter] = useState(false);
  const [expiryDays, setExpiryDays] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  // The cap is the sharer's business before they tap, not an error after.
  const shared = Math.min(itemCount, SHARE_MAX_ITEMS);
  const dropped = Math.max(0, itemCount - SHARE_MAX_ITEMS);

  const toggle = (key) => setFields((prev) => ({ ...prev, [key]: !prev[key] }));

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const url = await onCreate({
        fields,
        unlisted: isPro && unlisted,
        hideFooter: isPro && hideFooter,
        expiryDays: isPro ? expiryDays : null,
      });
      setLink(url);
      // Copy straight away. The link is useless in a modal, and the whole
      // point of the action is to paste it somewhere else.
      const ok = onCopy ? await onCopy(url) : false;
      setCopied(ok);
    } catch (err) {
      setError((err && err.message) || "The link could not be made.");
    } finally {
      setBusy(false);
    }
  };

  const proRow = (label, value, onToggle, help) => (
    <button
      type="button"
      className={"cz-share-row" + (isPro ? "" : " is-locked")}
      onClick={isPro ? onToggle : undefined}
      aria-pressed={isPro ? value : false}
      // A locked row is a statement, not a control. Making it a disabled
      // button hides it from a screen reader; leaving it enabled promises
      // something it will not do.
      aria-disabled={!isPro}
    >
      <span className="cz-share-row-main">
        <span className="cz-share-row-label">
          {label}
          {!isPro && <span className="cz-share-pro-tag">Pro</span>}
        </span>
        <span className="cz-share-row-help">{help}</span>
      </span>
      <span className="cz-share-row-val">{isPro ? (value ? "On" : "Off") : "Off"}</span>
    </button>
  );

  return (
    <ModalShell
      title={link ? "Your link is ready" : "Share this haul"}
      onClose={onClose}
      maxWidth={560}
      surfaceClassName="cz-share-sheet"
    >
      <div className="cz-share">
        {!signedIn ? (
          // Shared links live on the server, so they need an account. Say that
          // once, plainly, instead of letting the create button fail with 401.
          <div className="cz-share-note">
            <div className="cz-share-note-title">Sign in to share</div>
            <p className="cz-share-note-body">
              A share link lives on our servers, so it needs an account. Your shelf stays on this
              device either way.
            </p>
          </div>
        ) : link ? (
          <>
            <div className="cz-share-link-box">
              <code className="cz-share-link">{link}</code>
            </div>
            <p className="cz-share-note-body">
              {copied
                ? "The link is on your clipboard. Paste it anywhere."
                : "Copy the link above. Your browser blocked the automatic copy."}
            </p>
            <div className="cz-share-actions">
              <Pill
                primary
                style={{ flex: 1, minHeight: 46, borderRadius: 14 }}
                onClick={async () => {
                  const ok = onCopy ? await onCopy(link) : false;
                  setCopied(ok);
                }}
              >
                Copy link
              </Pill>
              <Pill style={{ flex: 1, minHeight: 46, borderRadius: 14 }} onClick={onClose}>
                Done
              </Pill>
            </div>
            <p className="cz-share-fine">
              This link is a copy, frozen now. Editing the haul does not change it. Delete it any
              time from Settings → Your data → Shared links.
            </p>
          </>
        ) : (
          <>
            <p className="cz-share-lead">
              {shared === 1 ? "One card" : shared + " cards"} from{" "}
              <strong>{haulName}</strong>, with the photos and the titles.
              {dropped > 0
                ? " The newest " + SHARE_MAX_ITEMS + " go in. " + dropped + " stay behind."
                : ""}
            </p>

            <div className="cz-share-label">Also include</div>
            <div className="cz-share-rows">
              {FIELD_ROWS.filter((row) => SHARE_FIELDS.includes(row.key)).map((row) => (
                <button
                  key={row.key}
                  type="button"
                  className="cz-share-row"
                  onClick={() => toggle(row.key)}
                  aria-pressed={!!fields[row.key]}
                >
                  <span className="cz-share-row-main">
                    <span className="cz-share-row-label">{row.label}</span>
                    <span className="cz-share-row-help">
                      {fields[row.key] ? row.on : row.off}
                    </span>
                  </span>
                  <span className="cz-share-row-val">{fields[row.key] ? "On" : "Off"}</span>
                </button>
              ))}
            </div>

            <div className="cz-share-label">Link settings</div>
            <div className="cz-share-rows">
              {proRow(
                "Unlisted",
                unlisted,
                () => setUnlisted((v) => !v),
                "No preview when pasted. The page still opens for anyone with the link."
              )}
              {proRow(
                "Hide the Credenza footer",
                hideFooter,
                () => setHideFooter((v) => !v),
                "Your haul, without our name at the bottom."
              )}
              <div className={"cz-share-row cz-share-row-static" + (isPro ? "" : " is-locked")}>
                <span className="cz-share-row-main">
                  <span className="cz-share-row-label">
                    Expires
                    {!isPro && <span className="cz-share-pro-tag">Pro</span>}
                  </span>
                  <span className="cz-share-row-help">
                    {isPro && expiryDays != null
                      ? "The link stops working after " + expiryLabel(expiryDays) + "."
                      : "The link works until you delete it."}
                  </span>
                </span>
                <span className="cz-share-expiry" role="group" aria-label="Link expiry">
                  {SHARE_EXPIRY_DAYS.map((days) => (
                    <button
                      key={String(days)}
                      type="button"
                      className={
                        "cz-share-expiry-opt" +
                        ((isPro ? expiryDays : null) === days ? " is-on" : "")
                      }
                      aria-pressed={(isPro ? expiryDays : null) === days}
                      aria-disabled={!isPro}
                      onClick={isPro ? () => setExpiryDays(days) : undefined}
                    >
                      {expiryLabel(days)}
                    </button>
                  ))}
                </span>
              </div>
            </div>

            {!isPro && (
              <button type="button" className="cz-share-upsell" onClick={onUpgrade}>
                Pro unlocks these for {PRICING.monthly} a month.
              </button>
            )}

            {error && (
              <div className="cz-share-error" role="alert">
                {error}
              </div>
            )}

            <div className="cz-share-actions">
              <Pill
                primary
                loading={busy}
                disabled={busy || shared === 0}
                style={{ flex: 1, minHeight: 48, borderRadius: 14 }}
                onClick={create}
              >
                {busy ? "Making the link…" : "Create link"}
              </Pill>
            </div>
            <p className="cz-share-fine">
              The link is a copy, frozen when you make it. Anyone holding it can read the page.
              Your QC photos are never shared.
            </p>
          </>
        )}
      </div>
    </ModalShell>
  );
}

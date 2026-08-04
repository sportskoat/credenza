// ═══════════════════════════════════════════════════════════════════════════════
// IndexingStrip.jsx — the band between the paste bar and the view tabs that
// carries one 64px row per indexing link (handoff: design_handoff_indexing_strip,
// direction 3a).
//
// Presentational only. The driver in credenza-fashion.jsx hands in row view
// models built by components/indexing.js; this file turns them into the strip.
// The governing constraint: the shelf grid below never moves — constant 64px
// rows, fixed-width columns, tabular counters, one curve (250ms) everywhere.
// ═══════════════════════════════════════════════════════════════════════════════

import React from "react";
import { failCopy, platformTile, rowStageLabel } from "./indexing.js";

// The house curve and the 250ms open duration, read from the motion tokens.
const EASE = "var(--ease-out)";
const DUR = "var(--dur-open)";

function Thumb({ src }) {
  return <img className="cz-index-thumb" src={src} alt="" aria-hidden="true" />;
}

function PhotoSlots({ rec, phone }) {
  // aria-hidden: the live region announces stage changes and completion only,
  // never a photo count.
  const total = rec.photoTotal || 8;
  const shown = Math.min(rec.thumbs.length, total);
  const gaps = Math.max(0, total - shown);
  return (
    <div className={"cz-index-photos" + (phone ? " is-phone" : "")} aria-hidden="true">
      {rec.thumbs.slice(0, total).map((src, i) => (
        <Thumb key={i} src={src} />
      ))}
      {Array.from({ length: gaps }, (_, i) => (
        <span key={"g" + i} className="cz-index-gap" />
      ))}
    </div>
  );
}

function LiveStatus({ rec, offline, slowTail, onCancel }) {
  const pct = Math.round(Math.max(0, Math.min(1, rec.progress)) * 100);
  return (
    <div className="cz-index-live">
      <span
        className={
          "cz-index-step" + (rec.state === "indexed" ? " is-indexed" : "")
        }
      >
        {rowStageLabel(rec, { offline, slowTail })}
      </span>
      <span className="cz-index-track" aria-hidden="true">
        <span
          className="cz-index-fill"
          style={{
            width: pct + "%",
            transition: "width " + DUR + " " + EASE,
          }}
        />
      </span>
      {slowTail && onCancel && (
        <button
          type="button"
          className="cz-index-pill is-cancel"
          onClick={() => onCancel(rec.id)}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

function FailedStatus({ rec, onRetry, onDismiss }) {
  return (
    <div className="cz-index-fail-actions">
      <button
        type="button"
        className="cz-index-pill is-retry"
        onClick={() => onRetry(rec.id)}
      >
        Retry
      </button>
      <button
        type="button"
        className="cz-index-pill is-dismiss"
        onClick={() => onDismiss(rec.id)}
      >
        Dismiss
      </button>
    </div>
  );
}

function StripRow({ rec, phone, offline, slowTail, onRetry, onDismiss, onCancel }) {
  const tile = platformTile(rec.platform);
  const failed = rec.state === "failed";
  return (
    <div className={"cz-index-row" + (failed ? " is-failed" : "")}>
      {!phone && (
        <div className="cz-index-id">
          <span
            className="cz-index-tile"
            style={{ background: tile.color, opacity: failed ? 0.4 : 1 }}
            aria-hidden="true"
          >
            {tile.letter}
          </span>
          <span className="cz-index-label">{rec.label}</span>
        </div>
      )}
      {failed ? (
        <div className="cz-index-photos">
          <span className="cz-index-fail-copy">{failCopy(rec.failReason)}</span>
        </div>
      ) : (
        <PhotoSlots rec={rec} phone={phone} />
      )}
      {phone ? null : (
        <div className="cz-index-status">
          {failed ? (
            <FailedStatus rec={rec} onRetry={onRetry} onDismiss={onDismiss} />
          ) : (
            <LiveStatus
              rec={rec}
              offline={offline}
              slowTail={slowTail}
              onCancel={onCancel}
            />
          )}
        </div>
      )}
      {phone && failed && (
        <FailedStatus rec={rec} onRetry={onRetry} onDismiss={onDismiss} />
      )}
    </div>
  );
}

// Desktop: header line + one 64px row per link.
// Phone: the strip collapses to the summary line plus the lead row; the rest
// of the queue rides in the headline.
export default function IndexingStrip({
  header,
  rows,
  lead,
  phone = false,
  offline = false,
  exiting = false,
  onRetry,
  onDismiss,
  onCancel,
}) {
  if (!rows.length) return null;
  const leadId = lead ? lead.id : null;
  const shown = phone ? rows.filter((r) => r.id === leadId) : rows;
  const leadRec = phone ? shown[0] : null;
  return (
    <div
      className={
        "cz-index-strip" + (phone ? " is-phone" : "") + (exiting ? " is-exiting" : "")
      }
      role="status"
      aria-live="polite"
    >
      <div className="cz-index-head">
        <span className="cz-index-headline">{header.headline}</span>
        <span className="cz-index-detail">
          {phone && leadRec && leadRec.state !== "failed"
            ? rowStageLabel(leadRec, { offline, slowTail: !!leadRec.slowTail })
            : header.detail}
        </span>
      </div>
      {shown.map((rec) => (
        <StripRow
          key={rec.id}
          rec={rec}
          phone={phone}
          offline={offline}
          slowTail={!!rec.slowTail}
          onRetry={onRetry}
          onDismiss={onDismiss}
          onCancel={onCancel}
        />
      ))}
      {phone && leadRec && leadRec.state !== "failed" && (
        <span className="cz-index-track is-phone" aria-hidden="true">
          <span
            className="cz-index-fill"
            style={{
              width: Math.round(Math.max(0, Math.min(1, leadRec.progress)) * 100) + "%",
              transition: "width " + DUR + " " + EASE,
            }}
          />
        </span>
      )}
      {phone && leadRec && leadRec.slowTail && leadRec.state !== "failed" && onCancel && (
        <button
          type="button"
          className="cz-index-pill is-cancel"
          onClick={() => onCancel(leadRec.id)}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

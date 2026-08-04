import { useCallback, useEffect, useState } from "react";
import { ModalShell } from "../credenza-fashion.jsx";

// Profile → Shared links (LB-8). Every link this account has made, with the
// one action that matters: delete it.
//
// The share sheet promises this page in its fine print — "Delete it any time
// from Profile → Shared links." A promise in a modal is a feature, so this
// exists.
//
// The list comes from the server, not from the device. A link made on a phone
// must be deletable from a laptop, and the shelf has never held the codes.
// `onList` and `onDelete` are the app's callbacks, because this sheet must not
// see a token.
//
// `embedded` renders the body alone, for the Profile modal's sub-page stack.

function dayLabel(ms) {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// What the row says under the title. Order matters: an expired link is the
// only fact worth leading with, because the link no longer works.
function subtitle(row, now) {
  const parts = [];
  if (row.expiresAt && row.expiresAt <= now) parts.push("Expired");
  else if (row.expiresAt) parts.push("Expires " + dayLabel(row.expiresAt));
  parts.push(row.count === 1 ? "1 item" : (row.count || 0) + " items");
  if (row.unlisted) parts.push("Unlisted");
  if (row.createdAt) parts.push("Made " + dayLabel(row.createdAt));
  return parts.join(" · ");
}

export default function SharedLinksSheet({
  onList,
  onDelete,
  onCopy,
  onClose,
  embedded = false,
  now = Date.now(),
}) {
  const [rows, setRows] = useState(null); // null = still loading
  const [error, setError] = useState("");
  // One code at a time, not a boolean: two rows must never both look busy.
  const [busyCode, setBusyCode] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  // Delete is two-tap, like Erase my data. The first tap arms one row.
  const [armedCode, setArmedCode] = useState("");
  // Kyle 2026-08-03 audit, finding 1: a failed load printed a message with no
  // button that could act on it. Copy and Delete only work on a row, and a
  // failed load has no rows. The load runs again from here.
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const retryList = useCallback(() => {
    setError("");
    setLoadFailed(false);
    setRows(null);
    setReloadKey((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await onList();
        if (alive) setRows(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!alive) return;
        setError((err && err.message) || "The list could not be loaded.");
        setLoadFailed(true);
        // An empty list and a failed load look identical otherwise, and the
        // second one must not read as "you have no links".
        setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [onList, reloadKey]);

  const remove = async (row) => {
    if (armedCode !== row.id) {
      setArmedCode(row.id);
      return;
    }
    setBusyCode(row.id);
    setError("");
    try {
      await onDelete(row.id);
      setRows((prev) => (prev || []).filter((r) => r.id !== row.id));
    } catch (err) {
      setError((err && err.message) || "The link could not be deleted.");
    } finally {
      setBusyCode("");
      setArmedCode("");
    }
  };

  const body = (
    <div className="cz-links">
      {rows === null ? (
        <p className="cz-links-empty">Loading your links…</p>
      ) : loadFailed ? null : rows.length === 0 ? (
        <p className="cz-links-empty">
          No shared links yet. Open a haul and tap Share to make one.
        </p>
      ) : (
        <div className="cz-links-rows">
          {rows.map((row) => (
            <div className="cz-links-row" key={row.id}>
              <div className="cz-links-main">
                <div className="cz-links-title">{row.title || "A Credenza haul"}</div>
                <div className="cz-links-meta">{subtitle(row, now)}</div>
                <code className="cz-links-url">{row.url || row.id}</code>
              </div>
              <div className="cz-links-actions">
                <button
                  type="button"
                  className="cz-links-btn"
                  onClick={async () => {
                    const ok = onCopy ? await onCopy(row.url || row.id) : false;
                    setCopiedCode(ok ? row.id : "");
                  }}
                >
                  {copiedCode === row.id ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  className={"cz-links-btn cz-links-del" + (armedCode === row.id ? " is-armed" : "")}
                  disabled={busyCode === row.id}
                  onClick={() => remove(row)}
                >
                  {busyCode === row.id
                    ? "Deleting…"
                    : armedCode === row.id
                      ? "Tap to confirm"
                      : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="cz-share-error" role="alert">
          {error}
          {/* Finding 1: only a failed LOAD needs this. A failed delete keeps
              its own Delete button on the row, so it is already answerable. */}
          {loadFailed && (
            <button type="button" className="cz-links-btn cz-links-retry" onClick={retryList}>
              Try again
            </button>
          )}
        </div>
      )}

      <p className="cz-share-fine">
        Deleting a link makes the page it served answer 404. It does not touch
        the haul on your shelf.
      </p>
    </div>
  );

  if (embedded) return body;
  return (
    <ModalShell title="Shared links" onClose={onClose} maxWidth={460}>
      {body}
    </ModalShell>
  );
}

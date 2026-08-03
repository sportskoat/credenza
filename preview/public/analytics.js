// Google Analytics 4, one file for the whole site.
//
// Kyle chose Google Analytics on 2026-07-29 (#analytics), over a paid
// cookieless tool. GA4 sets cookies, so this file cannot just drop the tag in:
// the Privacy notice promises the shelf is local-first, and an EU or UK visitor
// must say yes before a tracking cookie exists.
//
// STRICTER THAN CONSENT MODE ON PURPOSE. Consent Mode alone still loads
// gtag.js and sends a cookieless ping — Google would learn the page address and
// the IP of a visitor who never answered. The Privacy notice says "nothing
// reaches Google until you accept", so the code has to match the sentence:
// gtag.js is fetched only after Accept. Consent Mode stays configured as a
// second belt, in case a later edit moves the load earlier.
//
// Every public page and the app load THIS file, not gtag directly, so the
// measurement id and the consent rule live in one place. preview/scripts/
// add-analytics-tag.mjs is what puts the <script src="/analytics.js"> line into
// each page under preview/public.
//
// Nothing here sends an item title, a marketplace URL, a shelf record, or a
// body measurement. Custom events cover anonymous product milestones only:
// sign-in, allowances, checkout, successful reads, and Buy handoffs.
(function () {
  "use strict";

  // The measurement id for the Credenza web stream (Kyle, 2026-07-29). It is
  // public by design — it appears in every page of every site that uses GA4 —
  // so it lives in the file, not in a build variable the static pages cannot
  // read. Replace it with the placeholder "G-XXXXXXXXXX" to switch counting
  // off site-wide; the guard below then loads nothing and reports nothing.
  var MEASUREMENT_ID = "G-2DQSJN43LF";

  var CONSENT_KEY = "cz.analytics.consent";
  var GRANTED = "granted";
  var DENIED = "denied";

  // "G-XXXXXXXXXX" passes the shape test, so it needs its own line. Without it
  // the off switch above would silently do nothing.
  if (!/^G-[A-Z0-9]{6,}$/.test(MEASUREMENT_ID)) return;
  if (/^G-X+$/.test(MEASUREMENT_ID)) return;

  // Private browsing can throw on any localStorage touch, so every read and
  // write is guarded. A throw means "no answer yet", which shows the bar again
  // rather than counting somebody who never accepted.
  function storedChoice() {
    try {
      var v = window.localStorage.getItem(CONSENT_KEY);
      return v === GRANTED || v === DENIED ? v : null;
    } catch (err) {
      return null;
    }
  }

  function remember(choice) {
    try {
      window.localStorage.setItem(CONSENT_KEY, choice);
    } catch (err) {
      /* private mode: the choice holds for this page only */
    }
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  // Order matters: the consent default must be in the queue BEFORE gtag.js
  // loads, or the first pageview writes a cookie we did not have permission
  // for. ad_storage stays denied for good — the site runs no advertising.
  gtag("consent", "default", {
    ad_storage: DENIED,
    ad_user_data: DENIED,
    ad_personalization: DENIED,
    analytics_storage: DENIED,
    wait_for_update: 500,
  });

  var choice = storedChoice();
  var running = false;

  // Nothing above this line has touched the network. start() is the only place
  // that reaches Google, and only Accept calls it.
  function start() {
    if (running) return;
    running = true;
    gtag("consent", "update", { analytics_storage: GRANTED });

    var tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID;
    (document.head || document.documentElement).appendChild(tag);

    gtag("js", new Date());
    // anonymize_ip is on by default in GA4 and cannot be switched off; there is
    // nothing to set here for it.
    gtag("config", MEASUREMENT_ID);
    watchAppPages();
  }

  // The app is one page that rewrites its own address (Settings, an item, a
  // shared haul). Google counts a page only when it is told, so the three
  // calls that change the address are wrapped and each new address is
  // reported once. Public pages are separate documents and need none of this.
  var lastPath = null;
  function watchAppPages() {
    lastPath = window.location.pathname + window.location.search;
    function report() {
      var now = window.location.pathname + window.location.search;
      if (now === lastPath) return;
      lastPath = now;
      gtag("event", "page_view", {
        page_path: now,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
    ["pushState", "replaceState"].forEach(function (name) {
      var original = window.history[name];
      if (typeof original !== "function") return;
      window.history[name] = function () {
        var out = original.apply(this, arguments);
        report();
        return out;
      };
    });
    window.addEventListener("popstate", report);
  }

  if (choice === GRANTED) start();

  // The app calls this for product milestones. It stays silent until consent.
  window.czTrack = function (name, params) {
    if (!running || typeof name !== "string" || !name) return;
    gtag("event", name, params || {});
  };

  // The Privacy notice needs a way back. It reads the answer, and it clears the
  // answer so the bar asks again on the next page load.
  window.czAnalyticsChoice = function () {
    return storedChoice();
  };
  window.czAnalyticsForget = function () {
    try {
      window.localStorage.removeItem(CONSENT_KEY);
    } catch (err) {
      /* private mode: nothing was stored to remove */
    }
  };

  if (choice) return; // asked already; no bar

  // The bar carries its own styles. A public page and the app load different
  // stylesheets, and a shared class would need both to agree forever.
  function showBar() {
    if (document.getElementById("cz-consent-bar")) return;

    var bar = document.createElement("div");
    bar.id = "cz-consent-bar";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-live", "polite");
    bar.setAttribute("aria-label", "Visitor counting");
    bar.style.cssText = [
      "position:fixed",
      "left:12px",
      "right:12px",
      "bottom:12px",
      "z-index:2147483000",
      "max-width:560px",
      "margin:0 auto",
      "display:flex",
      "flex-wrap:wrap",
      "gap:10px",
      "align-items:center",
      "justify-content:space-between",
      "padding:12px 14px",
      "border-radius:14px",
      "background:#17181a",
      "color:#f4f4f5",
      "box-shadow:0 10px 30px rgba(0,0,0,0.35)",
      "font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif",
      // A phone with a home bar needs the extra room, or the bar sits under it.
      "padding-bottom:calc(12px + env(safe-area-inset-bottom,0px))",
    ].join(";");

    var words = document.createElement("p");
    words.style.cssText = "margin:0;flex:1 1 240px";
    words.appendChild(
      document.createTextNode("Credenza counts visits with Google Analytics. Your shelf stays on your device. ")
    );
    var link = document.createElement("a");
    link.href = "/privacy/";
    link.textContent = "Privacy notice";
    link.style.cssText = "color:#f4f4f5;text-decoration:underline";
    words.appendChild(link);

    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;flex:0 0 auto";

    function button(label, fill, ink) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = [
        "min-height:38px",
        "padding:0 14px",
        "border-radius:999px",
        "border:1px solid rgba(255,255,255,0.22)",
        "background:" + fill,
        "color:" + ink,
        "font:inherit",
        "font-weight:600",
        "cursor:pointer",
      ].join(";");
      return b;
    }

    var no = button("No thanks", "transparent", "#f4f4f5");
    var yes = button("Accept", "#f4f4f5", "#17181a");

    function close() {
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    }

    no.addEventListener("click", function () {
      remember(DENIED);
      close();
    });

    yes.addEventListener("click", function () {
      remember(GRANTED);
      start();
      close();
    });

    row.appendChild(no);
    row.appendChild(yes);
    bar.appendChild(words);
    bar.appendChild(row);
    document.body.appendChild(bar);
  }

  if (document.body) showBar();
  else document.addEventListener("DOMContentLoaded", showBar);
})();

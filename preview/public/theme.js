/* The public pages follow the colour the visitor picked inside the app.
 *
 * Kyle 2026-07-30, option B. Before this, the pages read the operating
 * system's light/dark setting while the app ignored it, so a Mac set to Light
 * showed light pages next to a dark product. The app keeps its own choice in
 * localStorage under "credenza-prefs-v1" ({ theme: "light" | "rainbow" }), and
 * the pages sit on the same origin, so they can read it.
 *
 * "rainbow" is the app's key for Blackout, the dark theme. Anything that is
 * not the exact string "light" counts as dark, so a new visitor, a browser
 * with storage blocked, and an unreadable record all land on dark.
 *
 * Every page ships with data-theme="dark" already on <html>, so the page is
 * dark before this file runs and with JavaScript switched off. This script
 * only ever moves a page to light. It must stay a blocking <script> in the
 * head: a deferred one runs after the first paint and the colour would jump.
 */
(function () {
  var theme = "dark";
  try {
    var raw = window.localStorage.getItem("credenza-prefs-v1");
    if (raw && JSON.parse(raw).theme === "light") theme = "light";
  } catch (err) {
    /* Storage can throw in private mode or behind a cookie block. Stay dark. */
  }
  var root = document.documentElement;
  root.setAttribute("data-theme", theme);

  // The browser paints its own chrome (the phone status bar, the tab strip on
  // some desktops) from <meta name="theme-color">. The page ships two of them,
  // each held behind a prefers-color-scheme media query. Those queries answer
  // the operating system, not the app, so the bar could stay light while the
  // page went dark. Replace the pair with one tag that names the real colour.
  //
  // This part waits for the rest of the head. The script runs before those two
  // tags are parsed, so a search made now would find nothing and leave three
  // tags on the page. The colour of the browser's own bar is not the page, so
  // waiting costs nothing visible.
  function oneThemeColor() {
    var colors = { dark: "#000000", light: "#f4f4f0" };
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].parentNode.removeChild(metas[i]);
    var meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", colors[theme]);
    document.head.appendChild(meta);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", oneThemeColor);
  else oneThemeColor();
})();

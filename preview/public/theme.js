/* Public pages stay on Blackout (dark).
 *
 * Kyle 2026-08-01: Gallery (light) is parked. The app no longer offers a
 * colourway switch. This file used to read localStorage and flip pages to
 * light when theme === "light". That path is gone.
 *
 * Every page ships with data-theme="dark" already on <html>, so the page is
 * dark before this file runs and with JavaScript switched off. This script
 * only sets theme-color for the browser chrome to match Blackout.
 */
(function () {
  var theme = "dark";
  var root = document.documentElement;
  root.setAttribute("data-theme", theme);

  // The browser paints its own chrome (the phone status bar, the tab strip on
  // some desktops) from <meta name="theme-color">. Replace any OS-based pair
  // with one Blackout colour.
  function oneThemeColor() {
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].parentNode.removeChild(metas[i]);
    var meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", "#050506");
    document.head.appendChild(meta);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", oneThemeColor);
  else oneThemeColor();
})();

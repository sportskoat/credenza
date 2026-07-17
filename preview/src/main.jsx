import { createRoot } from "react-dom/client";
import Credenza from "../../credenza-v3.jsx";

createRoot(document.getElementById("root")).render(<Credenza />);

// Register the precaching worker and surface a waiting update to the app.
// The app listens for "credenza:update-ready" and shows an "Update ready ·
// Restart" notification; Restart dispatches "credenza:apply-update", we tell
// the waiting worker to take over, and reload once it controls the page.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const announce = (worker) => {
          if (!worker) return;
          window.dispatchEvent(new CustomEvent("credenza:update-ready"));
          window.addEventListener(
            "credenza:apply-update",
            () => worker.postMessage("SKIP_WAITING"),
            { once: true }
          );
        };
        // Only an *update* has a waiting worker while the page is already
        // controlled; a first install activates silently.
        if (registration.waiting && navigator.serviceWorker.controller) {
          announce(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              announce(worker);
            }
          });
        });
      })
      .catch(() => {});

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

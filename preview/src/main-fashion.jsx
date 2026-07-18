import { createRoot } from "react-dom/client";
import Credenza from "../../credenza-fashion.jsx";

createRoot(document.getElementById("root")).render(<Credenza />);

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

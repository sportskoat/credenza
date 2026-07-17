import { createRoot } from "react-dom/client";
import Credenza from "../../credenza-v3.jsx";

createRoot(document.getElementById("root")).render(<Credenza />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

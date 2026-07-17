import "./storage-shim.js";
import { createRoot } from "react-dom/client";
import Credenza from "../../credenza-v3.jsx";

createRoot(document.getElementById("root")).render(<Credenza />);

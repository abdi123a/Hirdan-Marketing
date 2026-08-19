import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { startSystemThemeSync } from "./lib/system-theme";
import "./index.css";

// index.html sets the initial class before paint; this keeps it in sync when
// the OS switches scheme while the app is open.
startSystemThemeSync();

createRoot(document.getElementById("root")!).render(<App />);

import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./themes.css";
import "./matchday.css";
import "./matchdetail.css";
import "./players.css";
import "./finance.css";
import App from "./App.jsx";
import { AppearanceProvider } from "./appearance/AppearanceProvider.jsx";

// DEV-only states gallery (QA/screenshots). Dead-code-eliminated in production builds.
const qa = import.meta.env.DEV && new URLSearchParams(location.search).has("f5-match-demo");
const DevGallery = qa ? React.lazy(() => import("./dev/MatchDemo.jsx")) :
  import.meta.env.DEV && new URLSearchParams(window.location.search).has("f5-gallery")
    ? React.lazy(() => import("./dev/MatchdayStatesGallery.jsx"))
    : null;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppearanceProvider client={qa ? null : undefined}>
      {DevGallery ? (
        <React.Suspense fallback={null}>
          <DevGallery />
        </React.Suspense>
      ) : (
        <App />
      )}
    </AppearanceProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

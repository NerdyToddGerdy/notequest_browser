import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { SaveStatus } from "./ui/components/SaveStatus/SaveStatus.tsx";
import { ErrorBoundary } from "./ui/components/ErrorBoundary/ErrorBoundary.tsx";
import "./ui/theme/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <SaveStatus />
  </StrictMode>,
);

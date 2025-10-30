import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Workaround for the "ResizeObserver loop completed with undelivered notifications"
// Some browsers throw this error intermittently; swallow known ResizeObserver errors
// to avoid noisy logs or uncaught exceptions that crash the app.
if (typeof window !== "undefined" && (window as any).ResizeObserver) {
  const RO = (window as any).ResizeObserver as typeof ResizeObserver;
  const originalObserve = RO.prototype.observe;

  RO.prototype.observe = function (this: ResizeObserver, ...args: any[]) {
    try {
      return originalObserve.apply(this, args);
    } catch (e: any) {
      // Ignore the specific ResizeObserver loop errors which are non-actionable
      if (e instanceof Error && /ResizeObserver loop (limit exceeded|completed)/i.test(e.message)) {
        // swallow
        return;
      }
      throw e;
    }
  };
}

createRoot(document.getElementById("root")!).render(<App />);

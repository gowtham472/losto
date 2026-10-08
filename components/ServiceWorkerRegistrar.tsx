"use client";

import { useEffect } from "react";
import { requestPersistence } from "@/lib/db";
import { MERMAID_URL } from "@/lib/mermaid";

/**
 * Asks the worker to fetch the diagram renderer in the background, so the first
 * flowchart opened without a connection can still be drawn. Skipped when the
 * reader has asked their browser to save data; it is then fetched the first
 * time a diagram is actually on screen.
 */
function warmRenderer() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData || !navigator.onLine) return;
  navigator.serviceWorker.ready
    .then((registration) => registration.active?.postMessage({ type: "warm", urls: [MERMAID_URL] }))
    .catch(() => {});
}

/**
 * Registers the offline cache and asks the browser not to evict the library.
 * Skipped in development so it never fights Turbopack's hot reloads.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
      } catch {
        /* offline caching is a bonus; the app still works without it */
      }
    };

    register();
    requestPersistence().catch(() => {});

    // Well after first paint: nothing on screen is waiting for this.
    const timer = window.setTimeout(warmRenderer, 8000);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}

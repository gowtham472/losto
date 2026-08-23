"use client";

import { useEffect } from "react";
import { requestPersistence } from "@/lib/db";

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
  }, []);

  return null;
}

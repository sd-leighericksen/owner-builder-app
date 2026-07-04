"use client";

import { useEffect } from "react";

/** Registers the service worker for PWA shell caching (brief §2.4). */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline shell is progressive enhancement — never block the app.
      });
    }
  }, []);
  return null;
}

"use client";

import { useEffect, ReactNode } from "react";
import { validateEnvironment } from "@/lib/env-validation";

export function AppStartupValidator({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Client-side validation
      fetch("/api/startup-check")
        .then((res) => res.json())
        .then((data) => {
          if (!data.ready) {
            console.error("❌ App startup check failed");
            console.error("Missing environment variables:", data.missing);
          } else {
            console.log("✅ App ready - all environment variables configured");
          }
        })
        .catch((err) => {
          console.error("Startup check error:", err);
        });
    }
  }, []);

  return <>{children}</>;
}

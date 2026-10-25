import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Haupt-Tabs bleiben im Client-Cache: Wechseln (auch Zurückwischen) zeigt sofort die Seite, die Daten werden danach im Hintergrund aufgefrischt
    staleTimes: { dynamic: 300, static: 300 },
  },
  async headers() {
    return [
      {
        // Service Worker nie aus dem Browser-Cache: Updates müssen sofort ankommen
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;

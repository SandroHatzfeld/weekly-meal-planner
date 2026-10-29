import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Einstellungen sind in Tabs aufgeteilt: alte Adresse auf den ersten Tab
    return [{ source: "/settings", destination: "/settings/plan", permanent: false }];
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

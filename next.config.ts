import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep server-only packages out of the client bundle.
  serverExternalPackages: ["postgres", "@electric-sql/pglite"],
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
  ],
};

export default nextConfig;

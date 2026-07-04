import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Owner-Builder Project Management",
    short_name: "Owner-Builder",
    description: "Project management for Australian owner-builders: tasks, budget, compliance, site diary.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#567a30",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

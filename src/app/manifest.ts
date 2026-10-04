import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kimchi",
    short_name: "Kimchi",
    description: "Juegos de mesa para dos",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf5ec",
    theme_color: "#faf5ec",
    lang: "es-MX",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

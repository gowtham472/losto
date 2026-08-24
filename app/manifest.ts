import type { MetadataRoute } from "next";

/**
 * `share_target` is what makes Losto show up in the Android share sheet, so a
 * share link can go straight from an assistant or a browser into the library.
 */
type ManifestWithShareTarget = MetadataRoute.Manifest & {
  share_target?: {
    action: string;
    method: "GET" | "POST";
    enctype?: string;
    params: Record<string, string>;
  };
  launch_handler?: { client_mode: string[] };
};

export default function manifest(): ManifestWithShareTarget {
  return {
    id: "/",
    name: "Losto - offline study library",
    short_name: "Losto",
    description:
      "Save AI conversations and articles to your phone and read them with no signal.",
    start_url: "/library",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait-primary",
    background_color: "#fbfbfc",
    theme_color: "#fbfbfc",
    categories: ["education", "productivity", "books"],
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Library", short_name: "Library", url: "/library" },
      { name: "Add a chat", short_name: "Add", url: "/import" },
      { name: "Search library", short_name: "Search", url: "/search" },
      { name: "Study mode", short_name: "Study", url: "/study" },
    ],
    share_target: {
      action: "/import",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
  };
}

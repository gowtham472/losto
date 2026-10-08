import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

/**
 * Puts Mermaid's single-file build where the browser can fetch it by URL.
 *
 * Imported the usual way, Mermaid splits into a chunk per diagram type, and a
 * type nobody has drawn yet would be missing from the offline cache. One file
 * at one address can be cached whole - see lib/mermaid.ts. The version is in
 * the file name so the service worker can treat it as immutable.
 *
 * Done here rather than in a package script so there is no way to start or
 * build the app without it.
 */
function vendorMermaid(): string {
  const root = join(process.cwd(), "node_modules", "mermaid");
  const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    version: string;
  };

  const dir = join(process.cwd(), "public", "vendor");
  const name = `mermaid-${version}.min.js`;
  mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(dir)) {
    if (file.startsWith("mermaid-") && file !== name) rmSync(join(dir, file));
  }
  if (!existsSync(join(dir, name))) {
    copyFileSync(join(root, "dist", "mermaid.min.js"), join(dir, name));
  }
  return version;
}

const nextConfig: NextConfig = {
  // No reason to advertise the framework to every crawler and scraper.
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_MERMAID_VERSION: vendorMermaid(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // The worker must never be served stale, or updates never land.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // The version is in the name, so this never changes under a given URL.
        source: "/vendor/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "node:path";
import { loadRootEnvFile } from "./src/lib/root-env";

// One local file for both workspaces. Host/Vercel values still win.
loadRootEnvFile();

const apiOrigin =
  process.env.JOSE_INTERNAL_API_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  transpilePackages: ["@jose/shared"],
  // Keep tracing rooted at the monorepo so workspace deps resolve.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    remotePatterns: [],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // Proxy the API under the web origin so the HttpOnly session cookie is
  // first-party and never has to be read by client JavaScript.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;

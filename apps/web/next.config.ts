import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@jose/shared"],
  // Keep tracing rooted at the monorepo so workspace deps resolve.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    // Remote lesson imagery stays optional; owners must allowlist production hosts.
    remotePatterns: [],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;

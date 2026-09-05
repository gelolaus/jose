import type { NextConfig } from "next";
import path from "node:path";

const apiOrigin =
  process.env.JOSE_INTERNAL_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  transpilePackages: ["@jose/shared"],
  // Keep tracing rooted at the monorepo so workspace deps resolve.
  outputFileTracingRoot: path.join(__dirname, "../.."),
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

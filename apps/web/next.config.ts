import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@jose/shared"],
  // Keep tracing rooted at the monorepo so workspace deps resolve.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;

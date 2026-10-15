import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.MERAKI_BUILD_DIR || '.next-meraki',
  experimental: { cpus: 1 },
};

export default nextConfig;

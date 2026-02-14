import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://192.168.1.63:3000"],
  reactStrictMode: false,
};

export default nextConfig;

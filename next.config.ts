import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["pdf-parse", "playwright"],
  devIndicators: false,
  turbopack: { root: process.cwd() },
};
export default config;

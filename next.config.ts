import type { NextConfig } from "next";
const config: NextConfig = { serverExternalPackages: ["pdf-parse"], devIndicators: false, turbopack: { root: process.cwd() } };
export default config;

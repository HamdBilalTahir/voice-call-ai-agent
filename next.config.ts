import { type NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sindresorhus/is", "onnxruntime-node"],
};

export default nextConfig;

import { type NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@sindresorhus/is",
    "onnxruntime-node",
    "livekit-server-sdk",
  ],
};

export default nextConfig;

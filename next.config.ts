import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "onnxruntime-node",
    "sharp",
    "@huggingface/transformers",
  ],
  outputFileTracingIncludes: {
    "/*": ["./models/**"],
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const maxUploadMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB) || 2048;

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["maxmind", "busboy"],
  experimental: {
    serverActions: {
      bodySizeLimit: "60mb",
    },
    proxyClientMaxBodySize: `${maxUploadMb}mb`,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

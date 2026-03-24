import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  /**
   * Note: Vercel function timeout is configured in `vercel.json` (`maxDuration: 300`)
   * and route-segment config (`app/layout.tsx`), not via NextConfig fields.
   */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ktrtheitjtwpdvdvnlzj.supabase.co",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;

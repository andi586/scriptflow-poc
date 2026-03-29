import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  outputFileTracingIncludes: {
    '/app/api/audio/merge/route': [
      './node_modules/ffmpeg-static/**',
    ],
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
        source: "/merge",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/video/:path*",
        destination:
          "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/:path*",
      },
    ];
  },
};

export default nextConfig;

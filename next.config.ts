import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;

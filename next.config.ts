import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mobile-content.uber.com",
      },
      {
        protocol: "https",
        hostname: "cn-geo1.uber.com",
      },
      {
        protocol: "https",
        hostname: "d4p17acsd5wyj.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "tb-static.uber.com",
      },
    ],
  },
};
export default nextConfig;

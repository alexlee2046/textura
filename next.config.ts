import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.cos.*.myqcloud.com",
      },
      {
        protocol: "https",
        hostname: "www.xinvise.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

export default withNextIntl(nextConfig);

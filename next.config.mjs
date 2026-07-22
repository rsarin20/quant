/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pdf-parse / mammoth ship code that touches the filesystem at import time;
    // keep them external so server bundling doesn't trip over them.
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse and tz-lookup are CommonJS with filesystem access; keep them
  // external so the server bundler does not try to inline their data files.
  experimental: { serverComponentsExternalPackages: ['pdf-parse', 'tz-lookup'] },
};

export default nextConfig;

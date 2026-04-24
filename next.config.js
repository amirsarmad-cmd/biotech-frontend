/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // API base URL injected at build time, falls back at runtime
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://biotech-api-production-7ec4.up.railway.app',
  },
};

module.exports = nextConfig;

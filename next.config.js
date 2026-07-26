/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // better-sqlite3 reste un module natif externe au bundle.
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};
module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'storage.googleapis.com'],
  },
  // Increase response size limit
  experimental: {
    serverComponentsExternalPackages: ['bullmq', 'ioredis'],
    largePageDataBytes: 100 * 1024 * 1024, // 100MB
  },
  // Add rewrites for storage access
  async rewrites() {
    return [
      {
        source: '/storage/:path*',
        destination: '/api/storage/:path*',
      },
    ];
  },
};

module.exports = nextConfig; 
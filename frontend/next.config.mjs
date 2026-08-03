/** @type {import('next').NextConfig} */
const nextConfig = {
  // P0.3: Proxy API ke backend Express (dev). Override via NEXT_PUBLIC_API_URL.
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return [
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // MSW & its runtime deps ship untranspiled ESM. next/jest only transforms
  // packages listed here (it hardcodes node_modules into transformIgnorePatterns).
  transpilePackages: [
    'msw',
    '@mswjs/interceptors',
    '@open-draft/deferred-promise',
    '@open-draft/logger',
    '@open-draft/until',
    'headers-polyfill',
    'is-node-process',
    'outvariant',
    'strict-event-emitter',
    'graphql',
    'path-to-regexp',
    'type-fest',
  ],
  // P0.3: Proxy API & static uploads ke backend Express (dev). Override via NEXT_PUBLIC_API_URL.
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return [
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
      { source: '/uploads/:path*', destination: `${apiUrl}/uploads/:path*` },
    ];
  },
};

export default nextConfig;

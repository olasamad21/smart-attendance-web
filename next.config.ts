import type { NextConfig } from 'next';

// Where the Python face/attendance API runs. The browser never calls it directly:
// it calls /backend/* on this site and Next.js forwards the request server-side.
// That way a phone opening the site through a tunnel only ever talks to one HTTPS origin.
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow the dev server to be opened through a Cloudflare quick tunnel (npm run demo -- -Dev).
  allowedDevOrigins: ['*.trycloudflare.com'],
  experimental: {
    // First face check after the backend starts loads the model; give it time.
    proxyTimeout: 120_000,
  },
  async rewrites() {
    return [
      { source: '/backend/:path*', destination: `${BACKEND_URL}/:path*` },
    ];
  },
};

export default nextConfig;

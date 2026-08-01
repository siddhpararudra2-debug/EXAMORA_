import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: "/offline",
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["lucide-react"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/auth/:path(login|register)',
        destination: 'http://localhost:4000/api/auth/:path*',
      },
      {
        source: '/api/:path((?!auth).*)',
        destination: 'http://localhost:4000/api/:path*',
      },
    ];
  },
};

export default withPWA(nextConfig);

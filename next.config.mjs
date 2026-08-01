/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["lucide-react"],
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

export default nextConfig;

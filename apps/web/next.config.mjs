/** @type {import('next').NextConfig} */
const apiBase = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${apiBase}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;

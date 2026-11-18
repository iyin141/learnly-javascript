/** @type {import('next').NextConfig} */
const apiBase = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
// Only used when the web app runs outside Docker (no nginx gateway in front): forwards signed /cdn URLs to the CDN cache.
const cdnBase = process.env.CDN_INTERNAL_URL || "http://127.0.0.1:8090";

// NEXT_BASE_PATH (Docker build arg) or NEXT_PUBLIC_BASE_PATH; both end up in the client bundle as NEXT_PUBLIC_BASE_PATH
const basePath = process.env.NEXT_BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  ...(basePath ? { basePath } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
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
        source: "/cdn/:path*",
        destination: `${cdnBase}/cdn/:path*`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${apiBase}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pbs.twimg.com", // Twitter images
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com", // Cloudinary images
        pathname: "/**", // allow all paths under Cloudinary
      },
    ],
  },

  eslint: {
    ignoreDuringBuilds: true, // ✅ don't block build on lint errors
  },
};

module.exports = nextConfig;

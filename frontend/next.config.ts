import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // gera .next/standalone para imagem Docker mínima
  output: "standalone",

  images: {
    // permite servir imagens do backend de uploads
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "**",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;

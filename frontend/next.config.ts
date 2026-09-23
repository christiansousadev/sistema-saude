import type { NextConfig } from "next";

// deriva host/protocolo permitidos para imagens a partir da url real de storage —
// um wildcard https genérico (hostname: "**") anula a allowlist de segurança do next/image
const storageUrl = new URL(process.env.NEXT_PUBLIC_STORAGE_URL ?? "http://localhost:8000/uploads");

const nextConfig: NextConfig = {
  // gera .next/standalone para imagem Docker mínima
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: storageUrl.protocol === "https:" ? "https" : "http",
        hostname: storageUrl.hostname,
        port: storageUrl.port || undefined,
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;

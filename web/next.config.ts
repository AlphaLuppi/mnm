import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "pino", "picomatch"],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self' https://api.anthropic.com http://ipc.localhost https://ipc.localhost tauri://localhost; img-src 'self' data:; font-src 'self';",
        },
      ],
    },
  ],
};

export default nextConfig;

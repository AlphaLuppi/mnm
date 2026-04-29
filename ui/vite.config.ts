import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Add your tunnel/dev host via VITE_ALLOWED_HOSTS env var (comma-separated) if needed
    allowedHosts: process.env.VITE_ALLOWED_HOSTS?.split(",").map((h) => h.trim()),
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        ws: true,
      },
    },
  },
});

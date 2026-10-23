import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /api and /uploads are proxied to the API so a phone on the same Wi-Fi can use http://<pc-ip>:5173
const target = process.env.API_TARGET ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": target, "/uploads": target },
  },
});

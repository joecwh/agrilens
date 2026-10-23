import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.agrilens.app",
  appName: "AgriLens",
  webDir: "dist",
  // For native builds, set VITE_API_URL to your deployed API (https) before `npm run cap:sync`.
};

export default config;

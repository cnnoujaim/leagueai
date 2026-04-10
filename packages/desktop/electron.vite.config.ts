import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { config } from "dotenv";
import { resolve } from "node:path";

// Load .env from repo root so define values are available at build time
config({ path: resolve(__dirname, "..", "..", ".env") });

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      "process.env.LEAGUEAI_SERVER_URL": JSON.stringify(
        process.env.LEAGUEAI_SERVER_URL || "https://leagueai-server-production.up.railway.app"
      ),
      "process.env.SUPABASE_URL": JSON.stringify(
        process.env.SUPABASE_URL || "https://lkmzltfmwsnvzkbefpig.supabase.co"
      ),
      "process.env.SUPABASE_ANON_KEY": JSON.stringify(
        process.env.SUPABASE_ANON_KEY || ""
      ),
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react(), tailwindcss()],
  },
});

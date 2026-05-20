import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rendererPort = Number(process.env.CODESIGHT_RENDERER_PORT ?? 5180);

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    strictPort: true,
    host: "0.0.0.0",
    port: rendererPort,
  },
  preview: {
    host: "0.0.0.0",
    port: rendererPort + 100,
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("monaco-editor") || id.includes("@monaco-editor/react")) {
            return "monaco";
          }

          if (id.includes("/node_modules/d3") || id.includes("framer-motion")) {
            return "visualization";
          }

          if (id.includes("@supabase/supabase-js")) {
            return "supabase";
          }

          return undefined;
        },
      },
    },
  },
});

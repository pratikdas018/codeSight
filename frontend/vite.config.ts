import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
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

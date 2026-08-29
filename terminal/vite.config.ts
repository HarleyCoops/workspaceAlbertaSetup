import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5299,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.WA_TERMINAL_PORT || 8899}`,
      },
    },
  },
});

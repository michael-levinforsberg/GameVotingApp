import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { votesApiPlugin } from "./server/plugin.ts";

export default defineConfig({
  plugins: [react(), votesApiPlugin()],
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
});

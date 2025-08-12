import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { viteSourceLocator } from "@metagptx/vite-plugin-source-locator";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    viteSourceLocator({ prefix: "mgx" }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // μερικά libs κοιτάνε αυτά – τα κάνουμε safe στο browser
    "process.env": {},
    global: "window",
  },
  optimizeDeps: {
    include: ["buffer"], // βεβαιώνει ότι υπάρχει στο dev/bundle
  },
}));

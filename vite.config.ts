import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { viteSourceLocator } from "@metagptx/vite-plugin-source-locator";

export default defineConfig({
  plugins: [
    viteSourceLocator({ prefix: "mgx" }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["buffer"],      // για pre-bundle ώστε να μη λείπει σε prod
  },
  build: {
    cssCodeSplit: true,       // βεβαιώνουμε split (default, αλλά το δηλώνουμε)
    sourcemap: false,
  },
  define: {
    "process.env": {},        // μερικά libs το ακουμπάνε
  },
});

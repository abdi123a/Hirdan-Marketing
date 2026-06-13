import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import packageJson from "./package.json";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:1423',
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1300,
    rollupOptions: {output: {manualChunks: {react:['react','react-dom'],icons:['lucide-react']}}},
  },
});

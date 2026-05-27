import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // En producción, el build va a server/public para ser servido por Express
    outDir: path.resolve(__dirname, '../server/public'),
    emptyOutDir: true,
    sourcemap: false,
  },
});

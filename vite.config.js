import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = `http://localhost:${process.env.PORT || 3000}`;

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    // la lógica de `shared/` vive fuera de `web/` porque también la usa el servidor
    fs: { allow: ['..'] },
    // En desarrollo la API la sirve Express (npm run server:dev)
    proxy: {
      '/api': API_TARGET
    }
  }
});

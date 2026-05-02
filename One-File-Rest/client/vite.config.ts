import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const ATTACHED_ASSETS = path.resolve(__dirname, '../../attached_assets');

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    fs: {
      allow: [path.resolve(__dirname, '..'), ATTACHED_ASSETS],
    },
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': ATTACHED_ASSETS,
    },
  },
});

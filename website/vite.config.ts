import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VPS API URL - can be overridden with VITE_API_URL env var
const API_URL = process.env.VITE_API_URL || 'http://40.160.241.52';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5174,
    strictPort: false,
    proxy: {
      // Proxy all API routes to VPS server
      '/api': {
        target: API_URL,
        changeOrigin: true,
      },
      // Legacy chat route
      '/chat': {
        target: API_URL,
        changeOrigin: true,
      },
    },
  },
});

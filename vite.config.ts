import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev we proxy /api to the live BasedMining API to dodge browser CORS.
// In the built native app, CapacitorHttp (see capacitor.config.ts) handles
// absolute URLs natively, so we point at the full origin instead.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.basedmining.xyz',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});

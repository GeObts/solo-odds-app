import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'xyz.basedmining.soloodds',
  appName: 'Solo Mining Odds',
  webDir: 'dist',
  plugins: {
    // Route window.fetch through the native HTTP stack so calls to
    // api.basedmining.xyz work on-device without CORS restrictions.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;

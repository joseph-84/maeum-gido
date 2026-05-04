import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',
    cssMinify: 'esbuild',
    chunkSizeWarningLimit: 1400,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@ionic')) return 'ionic';
          if (id.includes('react') || id.includes('scheduler')) return 'react';
          if (id.includes('@capacitor')) return 'capacitor';
          return 'vendor';
        },
      },
    },
  },
});

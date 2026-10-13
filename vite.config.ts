import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Brembo-flight/',
  build: {
    target: 'es2022',
    rolldownOptions: { output: { manualChunks: (id) => id.includes('/node_modules/three/') ? 'three' : undefined } },
  },
});

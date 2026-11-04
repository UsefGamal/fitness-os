import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative base so the build works from Capacitor's https://localhost root
// and from any static preview path.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
});

import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Relative base so the build works from Capacitor's https://localhost root
// and from any static preview path. The version and release switch come
// from the same environment Gradle reads (scripts/build-apk.sh, CI), so
// About, bug reports and feature flags (lib/flags.js) match the APK.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APK_VERSION_NAME || pkg.version),
    __APP_BUILD__: JSON.stringify(process.env.APK_VERSION_CODE || 'local'),
    __RELEASE__: JSON.stringify(process.env.FITNESS_OS_RELEASE === '1'),
  },
});

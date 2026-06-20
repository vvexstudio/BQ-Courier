import { defineConfig } from 'vite';

// Single-page WebGL game. Nothing fancy yet — Vite gives us a fast dev server,
// ES module imports for three/addons, and a production build.
export default defineConfig({
  server: {
    host: true,
    open: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});

import { defineConfig } from 'vite';

export default defineConfig({
  // Ensures built CSS, scripts, and any later public assets work from Pages paths.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        tree: 'tree.html'
      }
    }
  }
});

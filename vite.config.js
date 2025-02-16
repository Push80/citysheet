import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/citysheet/', // Replace with your actual repository name
  build: {
    outDir: 'docs' // Change output folder to 'docs'
  }
});
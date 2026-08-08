import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': decodeURIComponent(new URL('./src', import.meta.url).pathname),
        },
    },
    server: {
    proxy: {
      '/api-proxy': {
        target: 'https://cloud.geminidata.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, ''),
      },
      '/twse-openapi': {
        target: 'https://openapi.twse.com.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/twse-openapi/, ''),
      },
    },
  },
});

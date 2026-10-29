import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Cross-origin isolation lets ONNX Runtime use multiple WebAssembly threads.
// Everything the app loads is same-origin (model, wasm, fonts, data), so this is safe.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  server: { port: 3000, host: '0.0.0.0', allowedHosts: true, headers: isolation },
  preview: { port: 3000, host: '0.0.0.0', allowedHosts: true, headers: isolation },
  build: { chunkSizeWarningLimit: 1500 },
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Distinct from template (HelloDave) default 5174 so both apps can run locally.
    port: 5180,
    allowedHosts: [
      'hellocarl.netbizsystems.com'
    ],
    proxy: {
      '/api': { target: 'http://127.0.0.1:3020', changeOrigin: true },
    },
  }
})

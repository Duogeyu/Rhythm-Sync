import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5188,
    strictPort: false,
    host: '0.0.0.0',
    allowedHosts: ['home.vrcc.cc', 'localhost', '127.0.0.1']
  }
})

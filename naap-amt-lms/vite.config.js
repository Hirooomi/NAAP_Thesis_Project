import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: true,
  }
})

// vite.config.js
export default defineConfig({
  server: {
    host: '0.0.0.0', // Allows connections from the tunnel
    port: 5173,
    strictPort: true,
  },
  // ... rest of your config
})
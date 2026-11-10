import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Configuration optimized for Microsoft Dev Tunnels testing
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss()
  ],
  server: {
    host: '0.0.0.0', // Allows connections from the Microsoft tunnel
    port: 5173,
    strictPort: true,
    // THE FIX: Explicitly whitelist your exact Microsoft Dev Tunnel domain
    allowedHosts: [
      '9j6zh67b-5173.asse.devtunnels.ms',
      '.devtunnels.ms',
      'localhost'
    ],
    cors: true
  }
})
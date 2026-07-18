import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Nécessaire pour GitHub Codespaces / Docker / accès réseau distant :
    // sans "host: true", Vite n'écoute que sur localhost et le port forwarding
    // de Codespaces ne peut rien afficher (page blanche / "connection refused").
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
})

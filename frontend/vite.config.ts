import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Em desenvolvimento, encaminha chamadas /api/* para o backend na porta 3001.
    // Em produção, o backend serve o frontend e o /api no mesmo domínio (mesma origem).
    // Usa regex (e não a string '/api', que o Vite trata como prefixo) para não
    // capturar rotas do React Router como /api-conta-azul num reload direto.
    proxy: {
      '^/api/.*': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})

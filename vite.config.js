import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate', // Aggiorna l'app da sola in background
      devOptions: { enabled: true }, // Ci permette di testarlo anche ora in fase di sviluppo
      manifest: {
        name: 'Chiosco Ordini',
        short_name: 'Chiosco',
        theme_color: '#4caf50',
        icons: [
          // Per ora usiamo icone vuote, potrai aggiungere i file grafici in /public in futuro
          { src: '/favicon.ico', sizes: '192x192', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})

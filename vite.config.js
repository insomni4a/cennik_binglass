import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/pdfmake')) {
            return 'pdfmake'
          }
          if (id.includes('/src/utils/pdfMakeLoader') || id.includes('/src/utils/generateOfferPdf')) {
            return 'pdf-tools'
          }
        },
      },
    },
  },
})

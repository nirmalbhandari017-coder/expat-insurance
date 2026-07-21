import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Built output lands in ../crm so the CRM ships as part of the static
// Netlify site at expatprotecthub.com/crm/
export default defineConfig({
  plugins: [react()],
  base: '/crm/',
  build: {
    outDir: '../crm',
    emptyOutDir: true,
  },
})

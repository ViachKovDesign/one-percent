import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// На GitHub Pages сайт живёт по адресу /one-percent/
export default defineConfig({
  base: '/one-percent/',
  plugins: [react()],
})

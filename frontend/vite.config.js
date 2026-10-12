import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 로컬 개발(npm run dev) 시 /api 요청을 백엔드로 넘긴다.
// 배포 환경에서는 nginx가 같은 역할을 한다 (frontend/nginx.conf).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})

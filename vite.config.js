import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// build 시에는 GitHub Pages 프로젝트 경로(/minecraft-project/)를 기준으로,
// dev 서버에서는 루트(/)를 기준으로 자산 경로를 생성한다.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/minecraft-project/' : '/',
  plugins: [react()],
}))

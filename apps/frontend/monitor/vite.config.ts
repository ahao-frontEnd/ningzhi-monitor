import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // server 配置, server 是 vite 提供的服务器，用于开发环境下的请求代理
  server: {
    proxy: {
      '/api': {
        // target: 'http://ningzhi-monitor-server:8081', // 目标服务器地址
        target: 'http://localhost:8081', // 目标服务器地址
        changeOrigin: true, // 改变源，解决跨域问题
      },
      '/dsn-api': {
        target: 'http://localhost:8080',
        // target: 'https://monitor.ningzhi2.site',
        changeOrigin: true,
        rewrite(path) {
          return path.replace(/^\/dsn-api/, '/api') // 本地
          // return path.replace(/^\/dsn-api/, '/dsn-api')  // 线上
        },
      },
    },
  },
})

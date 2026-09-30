import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5174,
    proxy: {
      '/dsn-api': {
        target: 'https://monitor.ningzhi2.site',
        changeOrigin: true,
        rewrite(path) {
          return path.replace(/^\/dsn-api/, '/dsn-api')
        },
      },
    },
  },
})

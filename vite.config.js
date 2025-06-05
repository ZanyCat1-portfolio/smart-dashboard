import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const basePath = env.VITE_BASE_PATH || '/'
  return {
    base: basePath,
    plugins: [
      vue(),
      {
        name: 'inject-base-tag',
        transformIndexHtml(html) {
          const baseTag = `<base href="${basePath}">`
          if (html.includes('<base ')) {
            return html.replace(/<base\s[^>]*>/i, baseTag)
          }
          return html.replace(/<head>/i, `<head>\n  ${baseTag}`)
        }
      }
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true
        },
        '/socket.io': {
          target: 'http://localhost:8080',
          ws: true,
          changeOrigin: true
        }
      }
    }
  }
})

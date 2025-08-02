import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load environment variables for the current mode
  const env = loadEnv(mode, process.cwd(), '')
  const basePath = env.VITE_BASE_PATH || '/'


  // Only load certs if running in dev and they exist
  let httpsConfig = false

  console.log("FRONTEND env.VITE_PORT: ", env.VITE_PORT)
  console.log("env.VITE_USE_HTTPS:", env.VITE_USE_HTTPS)
  if (env.VITE_USE_HTTPS === '1' || env.VITE_USE_HTTPS === 'true') {
    try {
      const key = fs.readFileSync(path.resolve(__dirname, 'cert/dev-key.pem'))
      const cert = fs.readFileSync(path.resolve(__dirname, 'cert/dev-cert.pem'))
      httpsConfig = { key, cert }
    } catch {
      httpsConfig = false
    }
  } else {
    httpsConfig = false
  }


  return {
    base: basePath,
    plugins: [
      vue(),
      // Injects or replaces the <base> tag in index.html with the configured base path
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
      port: env.VITE_PORT || 5173,
      https: httpsConfig,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE || 'https://localhost:8080',
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: env.VITE_API_BASE || 'https://localhost:8080',
          ws: true,
          changeOrigin: true,
          secure: false,
        }
      }

    }
  }
})

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
  try {
    const key = fs.readFileSync(path.resolve(__dirname, 'cert/dev-key.pem'))
    const cert = fs.readFileSync(path.resolve(__dirname, 'cert/dev-cert.pem'))
    httpsConfig = { key, cert }
  } catch {
    // No certs found or not running dev, skip https
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
      https: httpsConfig,
      proxy: {
        '/api': {
          target: 'https://192.168.4.23:8080',
          changeOrigin: true,
          secure: false, // allow self-signed cert
        },
        '/socket.io': {
          target: 'https://192.168.4.23:8080',
          ws: true,
          changeOrigin: true,
          secure: false, // allow self-signed cert
        }
      }
    }
  }
})

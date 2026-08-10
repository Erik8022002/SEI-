import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { getCompanySignals } from './api/company-signals.js'

function companySignalsDevApi(): Plugin {
  return {
    name: 'company-signals-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/company-signals', async (request, response) => {
        const url = new URL(request.url ?? '/', 'http://localhost')
        const ticker = url.searchParams.get('ticker')?.trim() ?? ''
        const market = url.searchParams.get('market')?.trim() ?? ''

        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        if (request.method !== 'GET' || !/^\d{4,6}$/.test(ticker) || !['上市', '上櫃'].includes(market)) {
          response.statusCode = 400
          response.end(JSON.stringify({ error: 'ticker 與 market 參數不正確' }))
          return
        }

        try {
          const result = await getCompanySignals({ ticker, market })
          response.statusCode = 200
          response.end(JSON.stringify(result))
        } catch (error) {
          response.statusCode = 502
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'FinMind 公司觀察資料同步失敗' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), companySignalsDevApi()],
  resolve: {
    alias: {
      '@': decodeURIComponent(new URL('./src', import.meta.url).pathname),
    },
  },
  server: {
    proxy: {
      '/api-proxy': {
        target: 'https://cloud.geminidata.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, ''),
      },
      '/twse-openapi': {
        target: 'https://openapi.twse.com.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/twse-openapi/, ''),
      },
    },
  },
})

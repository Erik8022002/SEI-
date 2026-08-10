const base = 'https://openapi.twse.com.tw/v1/opendata'
const endpoints = ['t187ap06_L_ci', 't187ap07_L_ci']
const tickers = new Set(['2313', '1101', '2317'])

for (const endpoint of endpoints) {
  const response = await fetch(`${base}/${endpoint}`, { headers: { Accept: 'application/json' } })
  console.log(`\n=== ${endpoint} HTTP ${response.status} ===`)
  if (!response.ok) continue
  const rows = await response.json()
  for (const ticker of tickers) {
    const row = Array.isArray(rows) ? rows.find((item) => String(item['公司代號'] ?? item['公司代碼'] ?? item.Code ?? '').trim() === ticker) : null
    console.log(`\n--- ${ticker} ---`)
    if (!row) {
      console.log('NOT FOUND')
      continue
    }
    console.log(JSON.stringify(row, null, 2))
  }
}

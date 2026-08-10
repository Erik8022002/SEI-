const base = 'https://openapi.twse.com.tw/v1/opendata'
const statementTypes = ['ci', 'mim', 'basi', 'bd', 'fh', 'ins']
const tickers = ['2313', '1101', '2317']

for (const ticker of tickers) {
  console.log(`\n################ ${ticker} ################`)
  for (const statement of ['06', '07']) {
    for (const type of statementTypes) {
      const endpoint = `t187ap${statement}_L_${type}`
      const response = await fetch(`${base}/${endpoint}`, { headers: { Accept: 'application/json' } })
      if (!response.ok) {
        console.log(`${endpoint}: HTTP ${response.status}`)
        continue
      }
      const rows = await response.json()
      const row = Array.isArray(rows) ? rows.find((item) => String(item['公司代號'] ?? item['公司代碼'] ?? item.Code ?? '').trim() === ticker) : null
      if (!row) continue
      console.log(`\n=== FOUND ${endpoint} ===`)
      console.log(JSON.stringify(row, null, 2))
    }
  }
}

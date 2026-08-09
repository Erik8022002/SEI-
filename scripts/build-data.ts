import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

const CSV_FILE_PATH = path.join(process.cwd(), 'data/comp.csv')
const OUTPUT_COMPANIES_PATH = path.join(process.cwd(), 'src/generated/companies.json')

async function convertCsvToCompanies() {
  try {
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.error(`❌ 找不到 CSV 檔案：${CSV_FILE_PATH}`)
      process.exit(1)
    }

    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8')
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, unknown>[]

    const companies = records.map((r) => ({
      id: String(r['公司代號'] || r['公司簡稱'] || r['公司名稱'] || ''),
      name: String(r['公司名稱'] || r['公司簡稱'] || ''),
      englishName: String(r['英文簡稱'] || ''),
      website: String(r['網址'] || '').trim(),
      ticker: String(r['公司代號'] || ''),
      taxId: String(r['營利事業統一編號'] || ''),
      industry: String(r['產業別'] || ''),
      market: r['上櫃日期'] ? '上櫃' : '上市',
      location: String(r['住址'] || ''),
      founded: String(r['成立日期'] || ''),
      employees: '',
      capital: String(r['實收資本額'] || ''),
      score: 0,
      scoreLabel: '',
      updatedAt: new Date().toISOString(),
      summary: '',
      metrics: [],
      strategyMetrics: [],
      scores: [],
      trend: [],
      events: [],
      historicalEvents: [],
      opportunities: [],
      risks: [],
      questions: [],
    }))

    fs.mkdirSync(path.dirname(OUTPUT_COMPANIES_PATH), { recursive: true })
    fs.writeFileSync(OUTPUT_COMPANIES_PATH, JSON.stringify(companies, null, 2), 'utf-8')
    console.log(`✅ 已生成公司主檔：${OUTPUT_COMPANIES_PATH}（${companies.length} 家）`)
    console.log('ℹ️ 法說會資料由 scripts/import-investor-conferences.mjs 獨立產生，不再使用公司 CSV 覆寫。')
  } catch (error) {
    console.error('❌ 公司主檔轉換失敗：', error)
    process.exit(1)
  }
}

void convertCsvToCompanies()

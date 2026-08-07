import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// 1. 設定 CSV 讀取路徑與輸出的 JSON 檔案路徑
const CSV_FILE_PATH = path.join(process.cwd(), 'data/comp.csv');
const OUTPUT_JSON_PATH = path.join(process.cwd(), 'src/generated/investor-conferences.json');
const OUTPUT_COMPANIES_PATH = path.join(process.cwd(), 'src/generated/companies.json');

async function convertCsvToTs() {
  try {
    // 檢查 CSV 是否存在
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.error(`❌ 找不到 CSV 檔案：${CSV_FILE_PATH}`);
      process.exit(1);
    }

    // 2. 讀取 CSV 檔案內容
    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');

    // 3. 解析 CSV（自動將第一列視為 Header 欄位名稱）
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, any>[];

    // 3.1 補齊常見欄位：若欄位不存在則以空字串填補
    const expectedFields = ['code', 'name', 'date', 'time', 'location', 'market', 'category', 'pdfUrl', 'webcastUrl']
    const normalizedRecords = records.map((rec: Record<string, any>) => {
      const out: Record<string, any> = { ...rec }
      for (const key of expectedFields) {
        if (!(key in out) || out[key] === undefined || out[key] === null) {
          out[key] = ''
        }
      }
      return out
    })

    // 4. 生成 JSON 結構並寫入 src/generated/investor-conferences.json
    // build a companies summary for quick lookups in the frontend
    const companiesSummaryMap: Record<string, { code: string; name: string; conferenceCount: number; group?: string; note?: string }> = {}
    for (const c of records) {
      const code = String(c['公司代號'] || c.code || '')
      if (!code) continue
      if (!companiesSummaryMap[code]) {
        companiesSummaryMap[code] = { code, name: String(c['公司名稱'] || c['公司簡稱'] || ''), conferenceCount: 0, group: '', note: '' }
      }
      companiesSummaryMap[code].conferenceCount += 1
    }
    const companiesSummary = Object.values(companiesSummaryMap)

    const payload = {
      generatedAt: new Date().toISOString(),
      source: {
        name: '公開資訊觀測站－法人說明會一覽表',
        url: 'https://mopsov.twse.com.tw/mops/web/t100sb02_1',
        years: [2024, 2025, 2026],
      },
      conferences: normalizedRecords,
      companies: companiesSummary,
    }

    // 4.1 產生 companies.json：從 CSV 欄位對應到 Project 的 Company 結構（以補齊為主）
    const companies = records.map((r: Record<string, any>) => ({
      id: String(r['公司代號'] || r['公司簡稱'] || r['公司名稱'] || ''),
      name: String(r['公司名稱'] || r['公司簡稱'] || ''),
      englishName: String(r['英文簡稱'] || ''),
      website: String((r['網址'] || '').trim()),
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

    // 5. 寫入 JSON 檔案（包含 conferences 與 companies）
    fs.mkdirSync(path.dirname(OUTPUT_JSON_PATH), { recursive: true })
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(payload, null, 2), 'utf-8');
    fs.writeFileSync(OUTPUT_COMPANIES_PATH, JSON.stringify(companies, null, 2), 'utf-8');
    console.log(`✅ 成功轉換 CSV 並生成：${OUTPUT_JSON_PATH}、${OUTPUT_COMPANIES_PATH} (共 ${records.length} 筆資料)`);

  } catch (error) {
    console.error('❌ 轉換失敗：', error);
  }
}

convertCsvToTs();
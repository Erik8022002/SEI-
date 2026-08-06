import { load } from 'cheerio'
import { mkdir, writeFile } from 'node:fs/promises'

const MOPS_ENDPOINT = 'https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1'
const MOPS_PDF_ROOT = 'https://mopsov.twse.com.tw/nas/STR/'
const OUTPUT_PATH = new URL('../src/generated/investor-conferences.json', import.meta.url)
const YEARS = [113, 114, 115]

const requestedCompanies = [
  { code: '2313', name: '華通', group: 'PCB', market: 'sii' },
  { code: '2316', name: '楠梓電', group: 'PCB', market: 'sii' },
  { code: '2328', name: '廣宇', group: 'PCB', market: 'sii' },
  { code: '2355', name: '敬鵬', group: 'PCB', market: 'sii' },
  { code: '2367', name: '燿華', group: 'PCB', market: 'sii', note: '使用正式簡稱；原清單為「耀華」' },
  { code: '2368', name: '金像電', group: 'PCB', market: 'sii' },
  { code: '2402', name: '毅嘉', group: 'PCB', market: 'sii' },
  { code: '3037', name: '欣興', group: 'PCB', market: 'sii' },
  { code: '3044', name: '健鼎', group: 'PCB', market: 'sii' },
  { code: '3229', name: '晟鈦', group: 'PCB', market: 'sii' },
  { code: '3321', name: '同泰', group: 'PCB', market: 'otc' },
  { code: '5469', name: '瀚宇博', group: 'PCB', market: 'sii' },
  { code: '6108', name: '競國', group: 'PCB', market: 'sii' },
  { code: '6141', name: '柏承', group: 'PCB', market: 'sii' },
  { code: '6153', name: '嘉聯益', group: 'PCB', market: 'sii' },
  { code: '6191', name: '精成科', group: 'PCB', market: 'sii' },
  { code: '6269', name: '台郡', group: 'PCB', market: 'sii' },
  { code: '6271', name: '同欣電', group: 'PCB', market: 'sii', note: '官方產業分類為半導體業' },
  { code: '6835', name: '圓裕', group: 'PCB', market: 'sii' },
  { code: '8046', name: '南電', group: 'PCB', market: 'sii' },
  { code: '8213', name: '志超', group: 'PCB', market: 'sii' },
  { code: '1416', name: '廣豐', group: '資訊服務業', market: 'sii', note: '官方產業分類為其他業' },
  { code: '2308', name: '台達電', group: '資訊服務業', market: 'sii', note: '官方產業分類為電子零組件業' },
  { code: '2371', name: '大同', group: '資訊服務業', market: 'sii', note: '官方產業分類為電機機械業' },
  { code: '2427', name: '三商電', group: '資訊服務業', market: 'sii' },
  { code: '2453', name: '凌群', group: '資訊服務業', market: 'sii' },
  { code: '2468', name: '華經', group: '資訊服務業', market: 'sii' },
  { code: '2471', name: '資通', group: '資訊服務業', market: 'sii' },
  { code: '2480', name: '敦陽科', group: '資訊服務業', market: 'sii' },
  { code: '3057', name: '喬鼎', group: '資訊服務業', market: 'sii', note: '官方產業分類為電腦及週邊設備業' },
  { code: '3130', name: '一零四', group: '資訊服務業', market: 'otc' },
  { code: '4585', name: '達明', group: '資訊服務業', market: 'sii', note: '2025 年上市；官方產業分類為其他電子業' },
  { code: '5203', name: '訊連', group: '資訊服務業', market: 'sii' },
  { code: '6112', name: '邁達特', group: '資訊服務業', market: 'sii' },
  { code: '6183', name: '關貿', group: '資訊服務業', market: 'sii' },
  { code: '6214', name: '精誠', group: '資訊服務業', market: 'sii' },
  { code: '6277', name: '宏正', group: '資訊服務業', market: 'sii', note: '官方產業分類為電腦及週邊設備業' },
  { code: '6614', name: '資拓宏宇', group: '資訊服務業', market: 'sii', note: '2025 年上市；官方產業分類為數位雲端業' },
  { code: '6906', name: '現觀科', group: '資訊服務業', market: 'sii', note: '官方產業分類為數位雲端業' },
  { code: '7765', name: '中華資安', group: '資訊服務業', market: 'sii', note: '2025 年上市；官方產業分類為數位雲端業' },
  { code: '7822', name: '倍利科', group: '資訊服務業', market: 'sii', note: '依原清單採倍利科；官方產業分類為半導體業，若原意為倍力則代碼為 6874' },
]

const cleanText = (value) => value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()

function toGregorian(rocDate) {
  if (rocDate.includes(' 至 ')) return rocDate.split(' 至 ').map(toGregorian).join(' 至 ')
  const match = rocDate.match(/^(\d{3})\/(\d{2})\/(\d{2})$/)
  if (!match) return rocDate
  return `${Number(match[1]) + 1911}-${match[2]}-${match[3]}`
}

function parseRows(html, market) {
  const $ = load(html)
  return $('#myTable tr[data-type="body"]').map((_, row) => {
    const cells = $(row).find('td')
    const presentationFile = (index) => $(cells[index]).find('a').attr('onclick')?.match(/fileName\.value="([^"]+)"/)?.[1] ?? null
    const links = (index) => $(cells[index]).find('a[href]').map((__, anchor) => $(anchor).attr('href')).get().filter((href) => href && href !== '#')
    const website = links(8)[0] ?? null
    const videos = links(9).filter((href) => href.startsWith('http')).map((href) => href.replace(/^http:/, 'https:'))
    const chineseFile = presentationFile(6)
    const englishFile = presentationFile(7)

    return {
      companyCode: cleanText($(cells[0]).text()),
      companyName: cleanText($(cells[1]).text()),
      market: market === 'sii' ? '上市' : '上櫃',
      date: toGregorian(cleanText($(cells[2]).text())),
      time: cleanText($(cells[3]).text()),
      location: cleanText($(cells[4]).text()),
      summary: cleanText($(cells[5]).text()),
      presentationZh: chineseFile ? MOPS_PDF_ROOT + chineseFile : null,
      presentationEn: englishFile ? MOPS_PDF_ROOT + englishFile : null,
      website,
      videos,
      note: cleanText($(cells[10]).text()).replace(/^無$/, ''),
      source: '公開資訊觀測站',
    }
  }).get()
}

async function fetchYear(market, year) {
  const body = new URLSearchParams({ step: '1', firstin: '1', off: '1', TYPEK: market, year: String(year), month: '', co_id: '' })
  const response = await fetch(MOPS_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'CompassFinancialIntelligence/0.1 (public-data importer)',
    },
    body,
  })
  if (!response.ok) throw new Error(`MOPS ${market} ${year} failed: ${response.status}`)
  return parseRows(await response.text(), market)
}

const companyCodes = new Set(requestedCompanies.map((company) => company.code))
const companyByCode = new Map(requestedCompanies.map((company) => [company.code, company]))
const allRows = []

for (const year of YEARS) {
  for (const market of ['sii', 'otc']) {
    process.stdout.write(`Fetching MOPS ${market} ROC ${year}... `)
    const rows = await fetchYear(market, year)
    allRows.push(...rows.filter((row) => companyCodes.has(row.companyCode)))
    console.log(`${rows.length} rows, ${allRows.length} selected total`)
  }
}

const conferences = allRows
  .filter((row, index, rows) => index === rows.findIndex((candidate) => candidate.companyCode === row.companyCode && candidate.date === row.date && candidate.time === row.time && candidate.summary === row.summary))
  .map((row) => ({ ...row, market: companyByCode.get(row.companyCode)?.market === 'sii' ? '上市' : '上櫃' }))
  .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))

const counts = new Map(conferences.map((row) => [row.companyCode, 0]))
conferences.forEach((row) => counts.set(row.companyCode, (counts.get(row.companyCode) ?? 0) + 1))

const output = {
  generatedAt: new Date().toISOString(),
  source: {
    name: '公開資訊觀測站－法人說明會一覽表',
    url: 'https://mopsov.twse.com.tw/mops/web/t100sb02_1',
    years: YEARS.map((year) => year + 1911),
  },
  companies: requestedCompanies.map((company) => ({ ...company, conferenceCount: counts.get(company.code) ?? 0 })),
  conferences,
}

await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Wrote ${conferences.length} conferences for ${requestedCompanies.length} companies to ${OUTPUT_PATH.pathname}`)

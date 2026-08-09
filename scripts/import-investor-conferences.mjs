import { load } from 'cheerio'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const MOPS_ENDPOINT = 'https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1'
const MOPS_PDF_ROOT = 'https://mopsov.twse.com.tw/nas/STR/'
const OUTPUT_PATH = new URL('../src/generated/investor-conferences.json', import.meta.url)
const COMPANY_PATH = new URL('../src/generated/companies.json', import.meta.url)
const currentRocYear = new Date().getFullYear() - 1911
const YEARS = [currentRocYear - 2, currentRocYear - 1, currentRocYear]

const groupOverrides = new Map([
  ['2313', { name: '華通', group: 'PCB' }],
  ['2316', { name: '楠梓電', group: 'PCB' }],
  ['2328', { name: '廣宇', group: 'PCB' }],
  ['2355', { name: '敬鵬', group: 'PCB' }],
  ['2367', { name: '燿華', group: 'PCB', note: '使用正式簡稱；原清單為「耀華」' }],
  ['2368', { name: '金像電', group: 'PCB' }],
  ['2402', { name: '毅嘉', group: 'PCB' }],
  ['3037', { name: '欣興', group: 'PCB' }],
  ['3044', { name: '健鼎', group: 'PCB' }],
  ['3229', { name: '晟鈦', group: 'PCB' }],
  ['3321', { name: '同泰', group: 'PCB' }],
  ['5469', { name: '瀚宇博', group: 'PCB' }],
  ['6108', { name: '競國', group: 'PCB' }],
  ['6141', { name: '柏承', group: 'PCB' }],
  ['6153', { name: '嘉聯益', group: 'PCB' }],
  ['6191', { name: '精成科', group: 'PCB' }],
  ['6269', { name: '台郡', group: 'PCB' }],
  ['6271', { name: '同欣電', group: 'PCB', note: '官方產業分類為半導體業' }],
  ['6835', { name: '圓裕', group: 'PCB' }],
  ['8046', { name: '南電', group: 'PCB' }],
  ['8213', { name: '志超', group: 'PCB' }],
  ['1416', { name: '廣豐', group: '資訊服務業', note: '官方產業分類為其他業' }],
  ['2308', { name: '台達電', group: '資訊服務業', note: '官方產業分類為電子零組件業' }],
  ['2371', { name: '大同', group: '資訊服務業', note: '官方產業分類為電機機械業' }],
  ['2427', { name: '三商電', group: '資訊服務業' }],
  ['2453', { name: '凌群', group: '資訊服務業' }],
  ['2468', { name: '華經', group: '資訊服務業' }],
  ['2471', { name: '資通', group: '資訊服務業' }],
  ['2480', { name: '敦陽科', group: '資訊服務業' }],
  ['3057', { name: '喬鼎', group: '資訊服務業', note: '官方產業分類為電腦及週邊設備業' }],
  ['3130', { name: '一零四', group: '資訊服務業' }],
  ['4585', { name: '達明', group: '資訊服務業', note: '2025 年上市；官方產業分類為其他電子業' }],
  ['5203', { name: '訊連', group: '資訊服務業' }],
  ['6112', { name: '邁達特', group: '資訊服務業' }],
  ['6183', { name: '關貿', group: '資訊服務業' }],
  ['6214', { name: '精誠', group: '資訊服務業' }],
  ['6277', { name: '宏正', group: '資訊服務業', note: '官方產業分類為電腦及週邊設備業' }],
  ['6614', { name: '資拓宏宇', group: '資訊服務業', note: '2025 年上市；官方產業分類為數位雲端業' }],
  ['6906', { name: '現觀科', group: '資訊服務業', note: '官方產業分類為數位雲端業' }],
  ['7765', { name: '中華資安', group: '資訊服務業', note: '2025 年上市；官方產業分類為數位雲端業' }],
  ['7822', { name: '倍利科', group: '資訊服務業', note: '依原清單採倍利科；官方產業分類為半導體業，若原意為倍力則代碼為 6874' }],
])

const cleanText = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()

function toGregorian(rocDate) {
  const text = cleanText(rocDate)
  if (text.includes(' 至 ')) return text.split(' 至 ').map(toGregorian).join(' 至 ')
  const match = text.match(/^(\d{3})\/(\d{2})\/(\d{2})$/)
  if (!match) return text
  return `${Number(match[1]) + 1911}-${match[2]}-${match[3]}`
}

function parseRows(html, market) {
  const $ = load(html)
  return $('#myTable tr[data-type="body"]').map((_, row) => {
    const cells = $(row).find('td')
    const presentationFile = (index) => $(cells[index]).find('a').attr('onclick')?.match(/fileName\.value=["']([^"']+)["']/)?.[1] ?? null
    const links = (index) => $(cells[index]).find('a[href]').map((__, anchor) => $(anchor).attr('href')).get().filter((href) => href && href !== '#')
    const website = links(8)[0] ?? null
    const videos = links(9)
      .filter((href) => /^https?:/i.test(href))
      .map((href) => href.replace(/^http:/i, 'https:'))
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
  }).get().filter((row) => /^\d{4,6}$/.test(row.companyCode) && row.date)
}

async function fetchYear(market, year) {
  const body = new URLSearchParams({
    step: '1',
    firstin: '1',
    off: '1',
    TYPEK: market,
    year: String(year),
    month: '',
    co_id: '',
  })

  const response = await fetch(MOPS_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      referer: 'https://mopsov.twse.com.tw/mops/web/t100sb02_1',
      'user-agent': 'CompassFinancialIntelligence/0.2 (public-data importer)',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
    body,
  })

  if (!response.ok) throw new Error(`MOPS ${market} ${year} failed: HTTP ${response.status}`)
  const html = await response.text()
  if (/查詢過於頻繁|請稍後再試/.test(html)) throw new Error(`MOPS ${market} ${year} rate limited`)

  const rows = parseRows(html, market)
  if (rows.length === 0) throw new Error(`MOPS ${market} ${year} returned no conference rows`)
  return rows
}

async function fetchYearWithRetry(market, year) {
  let lastError
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await fetchYear(market, year)
    } catch (error) {
      lastError = error
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 800))
    }
  }
  throw lastError
}

const companyMaster = JSON.parse(await readFile(COMPANY_PATH, 'utf8'))
const companyByCode = new Map(
  companyMaster
    .filter((company) => /^\d{4,6}$/.test(cleanText(company.ticker)))
    .map((company) => [cleanText(company.ticker), company]),
)
const companyCodes = new Set(companyByCode.keys())
const allRows = []

for (const year of YEARS) {
  for (const market of ['sii', 'otc']) {
    process.stdout.write(`Fetching MOPS ${market} ROC ${year}... `)
    const rows = await fetchYearWithRetry(market, year)
    const selected = rows.filter((row) => companyCodes.has(row.companyCode))
    allRows.push(...selected)
    console.log(`${rows.length} rows, ${selected.length} matched company master`)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

const conferences = allRows
  .filter((row, index, rows) => index === rows.findIndex((candidate) =>
    candidate.companyCode === row.companyCode
    && candidate.date === row.date
    && candidate.time === row.time
    && candidate.summary === row.summary,
  ))
  .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))

if (conferences.length === 0) {
  throw new Error('MOPS importer produced zero conferences; refusing to overwrite the conference dataset')
}

const counts = new Map()
conferences.forEach((row) => counts.set(row.companyCode, (counts.get(row.companyCode) ?? 0) + 1))

const trackedCodes = new Set([...counts.keys(), ...groupOverrides.keys()])
const companies = [...trackedCodes]
  .map((code) => {
    const master = companyByCode.get(code)
    const override = groupOverrides.get(code)
    const firstConference = conferences.find((row) => row.companyCode === code)
    return {
      code,
      name: override?.name || cleanText(master?.name) || firstConference?.companyName || code,
      conferenceCount: counts.get(code) ?? 0,
      group: override?.group ?? '其他',
      note: override?.note ?? '',
    }
  })
  .sort((a, b) => a.group.localeCompare(b.group, 'zh-TW') || a.code.localeCompare(b.code))

const output = {
  generatedAt: new Date().toISOString(),
  source: {
    name: '公開資訊觀測站－法人說明會一覽表',
    url: 'https://mopsov.twse.com.tw/mops/web/t100sb02_1',
    years: YEARS.map((year) => year + 1911),
  },
  companies,
  conferences,
}

await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`✅ Wrote ${conferences.length} conferences for ${companies.length} companies to ${OUTPUT_PATH.pathname}`)

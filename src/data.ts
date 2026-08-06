export type FinancialMetric = {
  label: string
  value: number
  delta: number
  suffix: string
  note: string
}

export type Event = {
  date: string
  category: '財務' | '營運' | '治理' | '市場'
  title: string
  summary: string
  impact: '正向' | '中性' | '留意'
}

export type HistoricalEvent = {
  date: string
  category: '技術投資' | '營運發展' | '公司治理' | '市場合作'
  title: string
  summary: string
}

export type Company = {
  id: string
  name: string
  englishName: string
  website: string
  ticker: string
  taxId: string
  industry: string
  market: string
  location: string
  founded: string
  employees: string
  capital: string
  score: number
  scoreLabel: string
  updatedAt: string
  summary: string
  metrics: FinancialMetric[]
  strategyMetrics: { id: string; label: string; value: string; note: string }[]
  scores: { label: string; value: number }[]
  trend: { quarter: string; revenue: number; profit: number }[]
  events: Event[]
  historicalEvents: HistoricalEvent[]
  opportunities: string[]
  risks: string[]
  questions: string[]
}

export const companies: Company[] = [
  {
    id: 'tsmc',
    name: '台灣積體電路製造',
    englishName: 'Taiwan Semiconductor Manufacturing Co., Ltd.',
    website: 'https://www.tsmc.com/chinese',
    ticker: '2330',
    taxId: '22099131',
    industry: '半導體業',
    market: '上市',
    location: '新竹科學園區',
    founded: '1987',
    employees: '76,478',
    capital: '2,593 億',
    score: 92,
    scoreLabel: '財務體質卓越',
    updatedAt: '2026/08/03 09:30',
    summary: '全球晶圓代工龍頭，先進製程維持領先。AI 與高效能運算需求驅動產品組合優化，資本支出與海外擴廠進度是中期觀察重點。',
    metrics: [
      { label: '近四季營收', value: 28943, delta: 31.6, suffix: '億元', note: '年增率' },
      { label: '稅後淨利', value: 11526, delta: 39.2, suffix: '億元', note: '年增率' },
      { label: '毛利率', value: 58.4, delta: 2.1, suffix: '%', note: '較去年' },
      { label: '負債比率', value: 24.7, delta: -1.8, suffix: '%', note: '較去年' },
    ],
    strategyMetrics: [
      { id: 'revenue', label: '近四季營收', value: '28,943 億', note: '年增 31.6%' },
      { id: 'grossMargin', label: '毛利率', value: '58.4%', note: '年增 2.1 個百分點' },
      { id: 'debtRatio', label: '負債比率', value: '24.7%', note: '年減 1.8 個百分點' },
      { id: 'currentRatio', label: '流動比率', value: '245.3%', note: '短期償債能力充足' },
      { id: 'eps', label: '近四季 EPS', value: '55.46 元', note: '年增 38.8%' },
      { id: 'netIncome', label: '稅後淨利', value: '11,526 億', note: '年增 39.2%' },
      { id: 'roe', label: '股東權益報酬率', value: '31.8%', note: '近四季' },
    ],
    scores: [
      { label: '獲利能力', value: 97 },
      { label: '償債能力', value: 94 },
      { label: '經營效率', value: 91 },
      { label: '成長動能', value: 88 },
    ],
    trend: [
      { quarter: '24 Q1', revenue: 5926, profit: 2255 },
      { quarter: '24 Q2', revenue: 6735, profit: 2478 },
      { quarter: '24 Q3', revenue: 7597, profit: 3253 },
      { quarter: '24 Q4', revenue: 8685, profit: 3747 },
      { quarter: '25 Q1', revenue: 8393, profit: 3616 },
      { quarter: '25 Q2', revenue: 9338, profit: 3983 },
    ],
    events: [
      { date: '2026.07.30', category: '營運', title: '先進封裝產能擴充計畫通過', summary: '董事會核准資本預算，擴充 CoWoS 與先進製程產能，以回應 AI 客戶需求。', impact: '正向' },
      { date: '2026.07.17', category: '財務', title: '公布第二季財務報告', summary: '營收與毛利率優於市場預期，先進製程占晶圓銷售金額比重持續提升。', impact: '正向' },
      { date: '2026.06.10', category: '市場', title: '海外廠建置時程更新', summary: '美國亞利桑那州廠量產進度符合規劃，海外營運成本仍需持續觀察。', impact: '中性' },
      { date: '2026.05.13', category: '治理', title: '董事會決議現金股利', summary: '核准每股現金股利新台幣 5 元，股利政策反映穩健現金流。', impact: '正向' },
      { date: '2026.04.08', category: '營運', title: '地震後營運影響說明', summary: '主要廠區安全系統正常，部分晶圓報廢影響可控，營運迅速恢復。', impact: '留意' },
    ],
    historicalEvents: [
      { date: '2025.03', category: '技術投資', title: '擴大美國先進製造投資', summary: '宣布規劃新增晶圓廠、先進封裝設施與研發中心，進一步擴大美國製造布局。' },
      { date: '2024.02', category: '營運發展', title: '日本熊本一廠正式開幕', summary: 'JASM 熊本廠開幕，並宣布規劃第二座晶圓廠，深化日本半導體供應鏈合作。' },
      { date: '2023.08', category: '技術投資', title: '德國 ESMC 設廠計畫', summary: '與 Bosch、Infineon、NXP 合資規劃德勒斯登晶圓廠，服務歐洲車用與工業客戶。' },
      { date: '2022.12', category: '技術投資', title: '3 奈米製程正式量產', summary: '南科 3 奈米製程進入量產，並擴大亞利桑那州先進製程投資規模。' },
      { date: '2021.11', category: '市場合作', title: '成立日本先進半導體製造公司', summary: '與 Sony Semiconductor Solutions 合作成立 JASM，後續加入 DENSO 等策略夥伴。' },
      { date: '2020.05', category: '技術投資', title: '宣布美國亞利桑那州設廠', summary: '規劃在亞利桑那州興建先進晶圓廠，開啟大規模海外先進製程布局。' },
      { date: '2018.06', category: '公司治理', title: '創辦人張忠謀退休', summary: '由劉德音擔任董事長、魏哲家擔任總裁，正式進入雙首長治理階段。' },
      { date: '2018.04', category: '技術投資', title: '7 奈米製程進入量產', summary: '7 奈米製程量產並快速擴大，成為高效能運算與行動裝置成長的重要基礎。' },
      { date: '2016.03', category: '技術投資', title: '核准南京 12 吋晶圓廠投資', summary: '於中國南京設立晶圓廠及設計服務中心，強化對當地客戶的服務。' },
      { date: '2015.07', category: '技術投資', title: '16 奈米 FinFET 進入量產', summary: '鰭式場效電晶體製程進入量產，延續先進製程競爭力。' },
      { date: '2011.10', category: '技術投資', title: '28 奈米製程量產', summary: '28 奈米製程開始量產，後續成為公司重要且長生命周期的製程節點。' },
      { date: '2009.06', category: '公司治理', title: '張忠謀回任執行長', summary: '因應金融危機後的產業轉折，張忠謀回任執行長並重新調整成長策略。' },
      { date: '2008.03', category: '技術投資', title: '40 奈米製程進入量產階段', summary: '推進 40 奈米製程，持續強化先進邏輯製程與晶圓代工服務。' },
      { date: '2006.01', category: '技術投資', title: '65 奈米製程擴大量產', summary: '65 奈米邏輯製程逐步放量，支援通訊、消費電子與運算應用。' },
    ],
    opportunities: ['AI 伺服器需求帶動先進製程與封裝', '海外擴廠衍生供應鏈金融與跨境金流需求', '龐大資本支出帶來設備融資合作機會'],
    risks: ['海外廠初期成本稀釋毛利率', '地緣政治與出口管制不確定性', '匯率波動影響新台幣計價營收'],
    questions: ['近期海外擴廠的資金調度重點為何？', 'AI 客戶需求對未來兩年資本支出的影響？', '如何切入供應鏈金融合作？'],
  },
  {
    id: 'honhai',
    name: '鴻海精密工業',
    englishName: 'Hon Hai Precision Industry Co., Ltd.',
    website: 'https://www.honhai.com/zh-tw/',
    ticker: '2317',
    taxId: '04541302',
    industry: '電子零組件業',
    market: '上市',
    location: '新北市土城區',
    founded: '1974',
    employees: '826,608',
    capital: '1,387 億',
    score: 84,
    scoreLabel: '財務體質穩健',
    updatedAt: '2026/08/03 09:30',
    summary: '全球電子製造服務龍頭，消費智能產品基本盤穩固，AI 伺服器業務快速成長。電動車平台與海外產能布局帶來中長期機會。',
    metrics: [
      { label: '近四季營收', value: 72314, delta: 15.2, suffix: '億元', note: '年增率' },
      { label: '稅後淨利', value: 1642, delta: 12.7, suffix: '億元', note: '年增率' },
      { label: '毛利率', value: 6.3, delta: 0.2, suffix: '%', note: '較去年' },
      { label: '負債比率', value: 57.1, delta: -0.8, suffix: '%', note: '較去年' },
    ],
    strategyMetrics: [
      { id: 'revenue', label: '近四季營收', value: '72,314 億', note: '年增 15.2%' },
      { id: 'grossMargin', label: '毛利率', value: '6.3%', note: '年增 0.2 個百分點' },
      { id: 'debtRatio', label: '負債比率', value: '57.1%', note: '年減 0.8 個百分點' },
      { id: 'currentRatio', label: '流動比率', value: '141.8%', note: '短期償債能力穩定' },
      { id: 'eps', label: '近四季 EPS', value: '11.84 元', note: '年增 12.3%' },
      { id: 'netIncome', label: '稅後淨利', value: '1,642 億', note: '年增 12.7%' },
      { id: 'roe', label: '股東權益報酬率', value: '10.6%', note: '近四季' },
    ],
    scores: [{ label: '獲利能力', value: 78 }, { label: '償債能力', value: 82 }, { label: '經營效率', value: 89 }, { label: '成長動能', value: 87 }],
    trend: [{ quarter: '24 Q1', revenue: 13224, profit: 220 }, { quarter: '24 Q2', revenue: 15511, profit: 350 }, { quarter: '24 Q3', revenue: 18546, profit: 493 }, { quarter: '24 Q4', revenue: 21324, profit: 463 }, { quarter: '25 Q1', revenue: 16420, profit: 421 }, { quarter: '25 Q2', revenue: 17983, profit: 445 }],
    events: [
      { date: '2026.07.14', category: '營運', title: 'AI 伺服器新產能正式投產', summary: '新產線開始量產次世代 AI 伺服器機櫃，預估下半年營收貢獻提升。', impact: '正向' },
      { date: '2026.06.28', category: '市場', title: '電動車策略合作更新', summary: '與國際車廠擴大平台合作，但量產爬坡進度仍是觀察重點。', impact: '中性' },
      { date: '2026.05.15', category: '財務', title: '公布第一季財務報告', summary: 'AI 雲端網路產品成長，產品組合改善帶動獲利率微幅上升。', impact: '正向' },
    ],
    historicalEvents: [
      { date: '2025.05', category: '營運發展', title: 'AI 伺服器業務持續擴產', summary: 'AI 伺服器與雲端網路產品成為主要成長動能，持續擴充全球產能與垂直整合能力。' },
      { date: '2024.11', category: '市場合作', title: '擴大 NVIDIA GB200 供應鏈布局', summary: '提高 AI 伺服器機櫃、散熱及關鍵零組件整合，強化次世代 AI 基礎設施製造能力。' },
      { date: '2023.10', category: '市場合作', title: '與 NVIDIA 推動 AI Factory', summary: '雙方宣布合作打造 AI 工廠，結合先進晶片、伺服器與智慧製造平台。' },
      { date: '2022.11', category: '市場合作', title: '與沙烏地阿拉伯成立 Ceer', summary: '與 PIF 合資成立電動車品牌 Ceer，拓展中東電動車市場與平台服務。' },
      { date: '2021.09', category: '技術投資', title: '取得 Lordstown Motors 廠房', summary: '透過製造合作與廠房交易建立北美電動車量產基地。' },
      { date: '2020.10', category: '技術投資', title: '發表 MIH 電動車開放平台', summary: '以開放式軟硬體平台整合電動車供應鏈，推動集團從製造服務跨入平台服務。' },
      { date: '2019.07', category: '公司治理', title: '劉揚偉接任董事長', summary: '創辦人郭台銘卸任董事長，由劉揚偉接任並推動集團轉型與事業群治理。' },
      { date: '2017.07', category: '技術投資', title: '宣布美國威斯康辛州投資計畫', summary: '宣布在美國建立製造基地，後續依市場與技術需求多次調整投資內容。' },
      { date: '2016.08', category: '市場合作', title: '完成收購日本夏普', summary: '完成對 Sharp 的策略投資，取得顯示器、品牌與消費電子技術資源。' },
      { date: '2014.05', category: '營運發展', title: '取得台灣 4G 頻譜與電信布局', summary: '透過關係企業投入 4G 與電信服務，擴展硬體製造之外的通訊服務版圖。' },
      { date: '2012.03', category: '市場合作', title: '啟動與夏普策略合作', summary: '投資堺顯示器工廠並展開策略合作，為後續收購 Sharp 奠定基礎。' },
      { date: '2010.06', category: '公司治理', title: '強化員工照護與生產管理', summary: '因應中國廠區勞工事件，調整薪資、員工支持與生產管理制度。' },
      { date: '2007.01', category: '營運發展', title: '全球消費電子製造規模擴大', summary: '隨智慧型裝置與消費電子客戶需求成長，持續擴張中國與全球製造據點。' },
      { date: '2006.05', category: '技術投資', title: '整合影像與機構件製造能力', summary: '透過事業整併與垂直整合，擴大相機模組、連接器及精密機構件能力。' },
    ],
    opportunities: ['AI 伺服器營收占比快速提升', '全球製造據點形成跨境現金管理需求', '電動車新事業需要長期專案融資'],
    risks: ['消費電子景氣循環', '低毛利商業模式承壓', '新事業投資回收期較長'],
    questions: ['AI 伺服器擴產需要哪些金融支援？', '全球資金歸集目前的主要痛點？', '電動車事業的資本配置原則為何？'],
  },
  {
    id: 'medigen',
    name: '高端疫苗生物製劑',
    englishName: 'Medigen Vaccine Biologics Corp.',
    website: 'https://www.medigenvac.com/',
    ticker: '6547',
    taxId: '53943057',
    industry: '生技醫療業',
    market: '上櫃',
    location: '新竹縣竹北市',
    founded: '2012',
    employees: '312',
    capital: '33.6 億',
    score: 61,
    scoreLabel: '成長潛力待驗證',
    updatedAt: '2026/08/03 09:30',
    summary: '聚焦疫苗研發與生物製劑，具技術與產能基礎，但營運受產品取證、訂單能見度及研發投入影響，現金流管理是關鍵。',
    metrics: [
      { label: '近四季營收', value: 8.7, delta: 8.4, suffix: '億元', note: '年增率' },
      { label: '稅後淨利', value: -2.4, delta: -16.1, suffix: '億元', note: '年增率' },
      { label: '毛利率', value: 44.2, delta: 3.8, suffix: '%', note: '較去年' },
      { label: '負債比率', value: 31.5, delta: 4.2, suffix: '%', note: '較去年' },
    ],
    strategyMetrics: [
      { id: 'revenue', label: '近四季營收', value: '8.7 億', note: '年增 8.4%' },
      { id: 'grossMargin', label: '毛利率', value: '44.2%', note: '年增 3.8 個百分點' },
      { id: 'debtRatio', label: '負債比率', value: '31.5%', note: '年增 4.2 個百分點' },
      { id: 'currentRatio', label: '流動比率', value: '186.4%', note: '仍具短期償債空間' },
      { id: 'eps', label: '近四季 EPS', value: '-0.72 元', note: '仍處虧損' },
      { id: 'netIncome', label: '稅後淨利', value: '-2.4 億', note: '年減 16.1%' },
      { id: 'roe', label: '股東權益報酬率', value: '-7.9%', note: '近四季' },
    ],
    scores: [{ label: '獲利能力', value: 42 }, { label: '償債能力', value: 76 }, { label: '經營效率', value: 58 }, { label: '成長動能', value: 70 }],
    trend: [{ quarter: '24 Q1', revenue: 1.2, profit: -0.8 }, { quarter: '24 Q2', revenue: 1.8, profit: -0.6 }, { quarter: '24 Q3', revenue: 2.1, profit: -0.4 }, { quarter: '24 Q4', revenue: 1.6, profit: -0.9 }, { quarter: '25 Q1', revenue: 2.3, profit: -0.7 }, { quarter: '25 Q2', revenue: 2.7, profit: -0.5 }],
    events: [
      { date: '2026.07.21', category: '營運', title: '新型疫苗進入三期試驗', summary: '候選產品完成受試者收案，預計明年提出藥證申請。', impact: '正向' },
      { date: '2026.06.03', category: '財務', title: '董事會通過現金增資案', summary: '預計募集資金用於臨床試驗及充實營運資金，股本稀釋風險需留意。', impact: '留意' },
      { date: '2026.04.12', category: '市場', title: '簽署東南亞授權意向書', summary: '潛在里程碑金尚待正式合約與當地法規審查確認。', impact: '中性' },
    ],
    historicalEvents: [
      { date: '2025.06', category: '市場合作', title: '持續推進國際疫苗授權合作', summary: '推動候選疫苗海外臨床、藥證與區域授權，拓展東南亞及其他國際市場。' },
      { date: '2024.12', category: '技術投資', title: '強化多元疫苗研發管線', summary: '持續投入腸病毒、流感與新型傳染病疫苗研發及製程平台。' },
      { date: '2023.10', category: '市場合作', title: '新冠疫苗國際臨床資料持續累積', summary: '透過國際合作與臨床研究累積保護效益及安全性資料。' },
      { date: '2022.07', category: '市場合作', title: '推進海外臨床與國際認證', summary: '於海外市場執行追加劑與免疫橋接研究，推動產品國際化。' },
      { date: '2021.08', category: '營運發展', title: 'MVC-COV1901 在台灣開始接種', summary: '新冠疫苗取得台灣緊急使用授權後納入公費接種計畫。' },
      { date: '2021.07', category: '營運發展', title: '新冠疫苗取得緊急使用授權', summary: 'MVC-COV1901 通過台灣主管機關專家審查並取得緊急使用授權。' },
      { date: '2020.02', category: '技術投資', title: '啟動新冠疫苗研發', summary: '與美國 NIH 技術合作，採用重組蛋白技術投入 COVID-19 疫苗開發。' },
      { date: '2019.06', category: '技術投資', title: '腸病毒 71 型疫苗完成關鍵臨床', summary: '持續完成多國臨床試驗與資料分析，推進產品藥證申請。' },
      { date: '2018.01', category: '技術投資', title: '擴充疫苗量產與品質系統', summary: '強化竹北廠區製程、品質管理及商業化量產準備。' },
      { date: '2017.04', category: '營運發展', title: '股票登錄興櫃交易', summary: '進入資本市場，擴大疫苗研發與臨床試驗所需資金來源。' },
      { date: '2015.09', category: '技術投資', title: '推進腸病毒疫苗臨床開發', summary: '核心候選疫苗進入臨床開發階段，建立兒童疫苗研發能力。' },
      { date: '2013.08', category: '技術投資', title: '建立細胞培養與蛋白疫苗平台', summary: '逐步建置研發、試量產與分析能力，形成自主疫苗技術基礎。' },
      { date: '2012.10', category: '公司治理', title: '高端疫苗成立', summary: '公司成立並聚焦疫苗與生物製劑研發，開始建置核心團隊與技術平台。' },
    ],
    opportunities: ['疫苗授權與國際市場合作', '臨床試驗及量產所需專案資金', '研發補助與永續連結融資'],
    risks: ['研發與取證時程不確定', '持續虧損造成現金流壓力', '單一產品訂單波動較大'],
    questions: ['未來 18 個月的現金水位規劃？', '授權合作預計如何認列收入？', '臨床與量產資金缺口有多大？'],
  },
]

export const suggestedSearches = ['2330', '鴻海', '53943057']

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// 1. 設定 CSV 讀取路徑與輸出的 TS 檔案路徑
const CSV_FILE_PATH = path.join(process.cwd(), 'data/conferences.csv');
const OUTPUT_TS_PATH = path.join(process.cwd(), 'src/data.ts');

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
    });

    // 4. 定義 TypeScript 型別與生成 src/data.ts 內容
    const tsContent = `// ⚠️ 此檔案由腳本自動生成，請勿手動修改
// 生成時間: ${new Date().toISOString()}

export interface Conference {
  code: string;
  name: string;
  date: string;
  time: string;
  location: string;
  market?: string;
  category?: string;
  pdfUrl?: string;
  webcastUrl?: string;
  [key: string]: any; // 允許其他自訂欄位
}

export const conferenceData: Conference[] = ${JSON.stringify(records, null, 2)};

export default conferenceData;
`;

    // 5. 寫入 src/data.ts
    fs.writeFileSync(OUTPUT_TS_PATH, tsContent, 'utf-8');
    console.log(`✅ 成功轉換 CSV 並生成：${OUTPUT_TS_PATH} (共 ${records.length} 筆資料)`);

  } catch (error) {
    console.error('❌ 轉換失敗：', error);
  }
}

convertCsvToTs();
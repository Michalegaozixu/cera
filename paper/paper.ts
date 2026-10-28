import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Define paths
const ENV_PATH = join(import.meta.dirname, ".env");

// Load OPENALEX_API_KEY from .env file in the script directory
// Free API key: https://openalex.org/settings/api
let openAlexApiKey = "";
if (existsSync(ENV_PATH)) {
  const envContent = readFileSync(ENV_PATH, "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index !== -1) {
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      const valClean = value.replace(/^['"]|['"]$/g, "");
      process.env[key] = valClean;
      if (key === "OPENALEX_API_KEY") openAlexApiKey = valClean;
    }
  }
}

const BASE_URL = "https://api.openalex.org";

// Pre-configured core ceramic and material science journals
const CORE_JOURNALS: Record<string, { name: string; issns: string[] }> = {
  jacs: {
    name: "Journal of the American Ceramic Society (美陶)",
    issns: ["0002-7820", "1551-2916"]
  },
  jecs: {
    name: "Journal of the European Ceramic Society (欧陶)",
    issns: ["0955-2219", "1873-619X"]
  },
  ci: {
    name: "Ceramics International (陶瓷国际)",
    issns: ["0272-8842", "1873-3956"]
  },
  jac: {
    name: "Journal of Advanced Ceramics (先进陶瓷)",
    issns: ["2226-4108", "2227-8508"]
  },
  jncs: {
    name: "Journal of Non-Crystalline Solids (玻璃/玻璃陶瓷)",
    issns: ["0022-3093", "1873-4812"]
  },
  solgel: {
    name: "Journal of Sol-Gel Science and Technology (溶胶凝胶)",
    issns: ["0928-0707", "1573-4846"]
  },
  acta: {
    name: "Acta Materialia (含陶瓷机理)",
    issns: ["1359-6454", "1873-2453"]
  }
};

// Virtual list grouping all core ceramic ISSNs
const ALL_CERAMIC_ISSNS = Object.values(CORE_JOURNALS)
  .flatMap(j => j.issns)
  .join("|");

// ─── ANSI 语义化配色调色板 (Terminal UI Spec) ─────────────────────
const A = {
  r:  "\x1b[0m",    // reset
  b:  "\x1b[1m",    // bold
  d:  "\x1b[2m",    // dim
  u:  "\x1b[4m",    // underline
  gr: "\x1b[90m",   // dark gray (卡片最外层边框、无数据占位符 —)
  cy: "\x1b[96m",   // bright cyan (键名、检索关键词)
  ye: "\x1b[93m",   // bright yellow (核心数值、DOI)
  gn: "\x1b[92m",   // bright green (主表格边框、成功状态)
  mg: "\x1b[95m",   // bright magenta
  rd: "\x1b[91m",   // bright red (错误与警告)
  wh: "\x1b[39m",   // 终端默认前景色 (深浅色终端自适应)
};

// ─── CJK / Unicode 视觉宽度计算 ──────────────────────────
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function getStrWidth(str: string): number {
  let len = 0;
  const stripped = stripAnsi(str);
  for (const ch of stripped) {
    const cp = ch.codePointAt(0)!;
    const wide =
      (cp >= 0x1100 && cp <= 0x115F) || // Hangul Jamo
      (cp >= 0x2E80 && cp <= 0x9FFF) || // CJK 部首、字符
      (cp >= 0xAC00 && cp <= 0xD7AF) || // 韩文
      (cp >= 0xF900 && cp <= 0xFAFF) || // CJK 兼容
      (cp >= 0xFF01 && cp <= 0xFF60) || // 全角 ASCII
      (cp >= 0xFFE0 && cp <= 0xFFE6);   // 全角符号
    len += wide ? 2 : 1;
  }
  return len;
}

function padStr(str: string, length: number): string {
  const len = getStrWidth(str);
  const padding = length - len;
  return padding > 0 ? str + " ".repeat(padding) : str;
}

// ─── 多行 ANSI 折行保护 ────────────────────────────────────
function wrapTextWithAnsi(raw: string, maxW: number): string[] {
  if (!raw) return ["—"];
  if (getStrWidth(raw) <= maxW) return [raw];

  interface Token {
    type: "ansi" | "space" | "word";
    text: string;
    vw: number;
  }

  const tokens: Token[] = [];
  const regex = /(\x1b\[[0-9;]*m)|(\s+)|([^\s\x1b]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    if (match[1]) {
      tokens.push({ type: "ansi", text: match[1], vw: 0 });
    } else if (match[2]) {
      const text = match[2].includes("\n") ? match[2] : " ";
      tokens.push({ type: "space", text, vw: text.length });
    } else if (match[3]) {
      tokens.push({ type: "word", text: match[3], vw: getStrWidth(match[3]) });
    }
  }

  const lines: string[] = [];
  let curLine = "";
  let curW = 0;
  let activeAnsi = "";

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok.type === "ansi") {
      if (tok.text === A.r) activeAnsi = "";
      else activeAnsi += tok.text;
      curLine += tok.text;
      continue;
    }

    if (tok.type === "space") {
      if (tok.text.includes("\n")) {
        if (activeAnsi) curLine += A.r;
        lines.push(curLine);
        curLine = activeAnsi;
        curW = 0;
        continue;
      }
      if (curW > 0 && curW + tok.vw <= maxW) {
        curLine += tok.text;
        curW += tok.vw;
      }
      continue;
    }

    if (tok.type === "word") {
      if (tok.vw > maxW) {
        if (curW > 0) {
          if (activeAnsi) curLine += A.r;
          lines.push(curLine);
          curLine = activeAnsi;
          curW = 0;
        }
        for (const ch of tok.text) {
          const cw = getStrWidth(ch);
          if (curW + cw > maxW) {
            if (activeAnsi) curLine += A.r;
            lines.push(curLine);
            curLine = activeAnsi + ch;
            curW = cw;
          } else {
            curLine += ch;
            curW += cw;
          }
        }
      } else {
        if (curW + tok.vw > maxW) {
          if (curLine.endsWith(" ")) curLine = curLine.slice(0, -1);
          if (activeAnsi) curLine += A.r;
          lines.push(curLine);
          curLine = activeAnsi + tok.text;
          curW = tok.vw;
        } else {
          curLine += tok.text;
          curW += tok.vw;
        }
      }
    }
  }

  if (curW > 0 || curLine) {
    if (curLine.endsWith(" ")) curLine = curLine.slice(0, -1);
    if (activeAnsi && !curLine.endsWith(A.r)) curLine += A.r;
    lines.push(curLine);
  }

  return lines.length > 0 ? lines : ["—"];
}

// ─── 横向圆角表格生成器（带内嵌圆角边框与智能列宽分配）─────
function getHorizontalTableLinesWrapped(
  headers: string[],
  rows: string[][],
  maxTableWidth: number = 76,
  valueColor: string = A.wh,
  borderColor: string = A.gn
): string[] {
  const numCols = headers.length;

  const idealWidths = headers.map((h, colIdx) => {
    let maxW = getStrWidth(h);
    for (const row of rows) {
      if (row[colIdx]) {
        maxW = Math.max(maxW, getStrWidth(row[colIdx]));
      }
    }
    return Math.max(maxW, 4);
  });

  const minWidths = headers.map((h, colIdx) => {
    let minW = getStrWidth(h);
    for (const row of rows) {
      if (row[colIdx]) {
        const words = stripAnsi(row[colIdx]).split(/\s+/);
        for (const w of words) {
          minW = Math.max(minW, getStrWidth(w));
        }
      }
    }
    return Math.min(minW, 30);
  });

  const totalIdeal = idealWidths.reduce((a, b) => a + b, 0) + (numCols - 1) * 3 + 4;
  let colWidths: number[] = [];

  if (totalIdeal <= maxTableWidth) {
    colWidths = idealWidths;
  } else {
    const separatorsW = (numCols - 1) * 3 + 4;
    const availW = Math.max(numCols * 6, maxTableWidth - separatorsW);

    colWidths = new Array(numCols).fill(0);
    let remainingAvailW = availW;
    const flexCols: number[] = [];

    for (let i = 0; i < numCols; i++) {
      if (idealWidths[i] <= 18) {
        colWidths[i] = idealWidths[i];
        remainingAvailW -= idealWidths[i];
      } else {
        flexCols.push(i);
      }
    }

    if (flexCols.length > 0 && remainingAvailW > flexCols.length * 6) {
      const sumFlexIdeal = flexCols.reduce((sum, idx) => sum + idealWidths[idx], 0);
      for (const idx of flexCols) {
        const prop = Math.floor((idealWidths[idx] / sumFlexIdeal) * remainingAvailW);
        colWidths[idx] = Math.max(minWidths[idx], prop);
      }
    } else {
      const sumIdeal = idealWidths.reduce((a, b) => a + b, 0);
      colWidths = idealWidths.map((w, idx) => {
        const prop = Math.floor((w / sumIdeal) * availW);
        return Math.max(minWidths[idx], prop);
      });
    }
  }

  const top = `${borderColor}╭─` + colWidths.map(w => "─".repeat(w)).join("─┬─") + `─╮${A.r}`;
  const mid = `${borderColor}├─` + colWidths.map(w => "─".repeat(w)).join("─┼─") + `─┤${A.r}`;
  const bot = `${borderColor}╰─` + colWidths.map(w => "─".repeat(w)).join("─┴─") + `─╯${A.r}`;

  const hLine = `${borderColor}│${A.r} ` + headers.map((h, i) => `${borderColor}${padStr(h, colWidths[i])}${A.r}`).join(` ${borderColor}│${A.r} `) + ` ${borderColor}│${A.r}`;

  const result = [top, hLine, mid];

  rows.forEach((row, rIdx) => {
    if (rIdx > 0) result.push(mid);

    const cellLines: string[][] = headers.map((_, colIdx) => {
      return wrapTextWithAnsi(row[colIdx] || "—", colWidths[colIdx]);
    });

    const maxRowLines = Math.max(...cellLines.map(lines => lines.length), 1);

    for (let lineIdx = 0; lineIdx < maxRowLines; lineIdx++) {
      const lineCells = headers.map((_, colIdx) => {
        const cellText = cellLines[colIdx][lineIdx] || "";
        return `${valueColor}${padStr(cellText, colWidths[colIdx])}${A.r}`;
      });
      result.push(`${borderColor}│${A.r} ` + lineCells.join(` ${borderColor}│${A.r} `) + ` ${borderColor}│${A.r}`);
    }
  });

  result.push(bot);
  return result;
}

// ─── 最外层灰色圆角卡片渲染器 ──────────────────────────────
function printCardWithTables(titleRaw: string, tableBlocks: string[][]) {
  const allContentLines = tableBlocks.flat();
  const maxLineWidth = Math.max(...allContentLines.map(line => getStrWidth(line)), getStrWidth(titleRaw));

  const termWidth = process.stdout.columns || 80;
  const maxInnerWidth = Math.max(76, maxLineWidth);

  const boxTotalWidth = maxInnerWidth + 4;
  const outerMargin = Math.max(0, Math.floor((termWidth - boxTotalWidth) / 2));
  const omStr = " ".repeat(outerMargin);

  const printInnerLine = (line: string, rawWidth: number) => {
    const padding = Math.max(0, maxInnerWidth - rawWidth);
    const lPad = Math.floor(padding / 2);
    const rPad = padding - lPad;
    console.log(`${omStr}${A.gr}│${A.r} ${" ".repeat(lPad)}${line}${" ".repeat(rPad)} ${A.gr}│${A.r}`);
  };

  const tLen = getStrWidth(titleRaw);
  const dashCount = Math.max(2, maxInnerWidth + 2 - tLen);
  const lDash = Math.floor(dashCount / 2);
  const rDash = dashCount - lDash;

  console.log();
  console.log(`${omStr}${A.gr}╭${"─".repeat(lDash)}${A.gn}${titleRaw}${A.gr}${"─".repeat(rDash)}╮${A.r}`);
  console.log(`${omStr}${A.gr}│${A.r} ${" ".repeat(maxInnerWidth)} ${A.gr}│${A.r}`);

  tableBlocks.forEach((block, bIdx) => {
    if (bIdx > 0) {
      console.log(`${omStr}${A.gr}│${A.r} ${" ".repeat(maxInnerWidth)} ${A.gr}│${A.r}`);
    }
    block.forEach(line => printInnerLine(line, getStrWidth(line)));
  });

  console.log(`${omStr}${A.gr}│${A.r} ${" ".repeat(maxInnerWidth)} ${A.gr}│${A.r}`);
  console.log(`${omStr}${A.gr}╰${"─".repeat(maxInnerWidth + 2)}╯${A.r}`);
  console.log();
}

// Main process
async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command) {
    console.error(`${A.rd}Error: Missing command.${A.r}`);
    process.exit(1);
  }

  const validCommands = [
    "search", "info", "download", "group", "stats", 
    "topics", "topic", "inst", "institution", "institutions"
  ];

  if (!validCommands.includes(command)) {
    console.error(`${A.rd}Error: Unknown command "${command}".${A.r}`);
    process.exit(1);
  }

  const parsed = parseArgs(args.slice(1));

  try {
    switch (command) {
      case "search":
        await handleSearch(parsed);
        break;
      case "info":
        await handleInfo(parsed);
        break;
      case "download":
        await handleDownload(parsed);
        break;
      case "group":
      case "stats":
        await handleGroup(parsed);
        break;
      case "topics":
      case "topic":
        await handleTopics(parsed);
        break;
      case "inst":
      case "institution":
      case "institutions":
        await handleInst(parsed);
        break;
    }
  } catch (error: any) {
    console.error(`${A.rd}Error: ${error.message || error}${A.r}`);
  }
}

// Basic argument parser
function parseArgs(args: string[]) {
  const result: { positional: string[]; options: Record<string, string | boolean> } = {
    positional: [],
    options: {}
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("-")) {
      const name = arg.replace(/^-+/, "");
      const nextVal = args[i + 1];
      if (nextVal && !nextVal.startsWith("-")) {
        result.options[name] = nextVal;
        i++;
      } else {
        result.options[name] = true;
      }
    } else {
      result.positional.push(arg);
    }
  }
  return result;
}

// Helper to check options by long and short name
function getOpt(parsed: any, longName: string, shortName?: string): any {
  if (parsed.options[longName] !== undefined) return parsed.options[longName];
  if (shortName && parsed.options[shortName] !== undefined) return parsed.options[shortName];
  return undefined;
}

// Clean DOI strings to isolate raw numbers
function cleanDOI(input: string): string {
  let clean = input.trim();
  clean = clean.replace(/^https?:\/\/doi\.org\//i, "");
  clean = clean.replace(/^\//, "");
  return clean;
}

// Reconstruct OpenAlex inverted index abstract to plain text
function reconstructAbstract(invertedIndex: any): string {
  if (!invertedIndex || typeof invertedIndex !== "object" || Object.keys(invertedIndex).length === 0) {
    return "(No abstract available / Paywalled)";
  }

  const words: string[] = [];
  try {
    for (const [word, positions] of Object.entries(invertedIndex)) {
      if (Array.isArray(positions)) {
        for (const pos of positions) {
          if (typeof pos === "number") {
            words[pos] = word;
          }
        }
      }
    }
    return words.filter(w => w !== undefined).join(" ").trim();
  } catch (e) {
    return "(Failed to reconstruct abstract from inverted index)";
  }
}

// Fetch generic OpenAlex REST API helper
async function fetchOpenAlex(path: string, params: Record<string, string>) {
  const finalParams: Record<string, string> = { ...params };
  if (openAlexApiKey) {
    finalParams["api_key"] = openAlexApiKey;
  }
  const urlParams = new URLSearchParams(finalParams);
  const url = `${BASE_URL}${path}?${urlParams.toString()}`;
  
  const headers: Record<string, string> = { "accept": "application/json" };

  try {
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      throw new Error(`OpenAlex returned HTTP status ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error: any) {
    throw new Error(`Request to OpenAlex failed: ${error.message}`);
  }
}

// Fetch a single work by DOI or ID
async function fetchSingleWork(idOrDoi: string) {
  let path = "";
  const cleaned = idOrDoi.trim();
  
  if (cleaned.match(/^W\d+$/i)) {
    path = `/works/${cleaned.toUpperCase()}`;
  } else {
    const doi = cleanDOI(cleaned);
    path = `/works/https://doi.org/${doi}`;
  }

  const urlParams = new URLSearchParams();
  if (openAlexApiKey) urlParams.set("api_key", openAlexApiKey);
  const qs = urlParams.toString();
  const url = `${BASE_URL}${path}${qs ? "?" + qs : ""}`;

  const headers: Record<string, string> = { "accept": "application/json" };

  try {
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error: any) {
    throw new Error(`Failed to fetch work metadata: ${error.message}`);
  }
}

// Resolve any DOI or W-ID input into a valid OpenAlex Work ID (e.g. W2741809807)
async function resolveToWorkId(input: string): Promise<string> {
  const cleaned = input.trim();
  if (cleaned.match(/^W\d+$/i)) {
    return cleaned.toUpperCase();
  }
  const work = await fetchSingleWork(cleaned);
  if (work && work.id) {
    return work.id.replace("https://openalex.org/", "");
  }
  return cleanDOI(cleaned);
}

// Helper to construct filter strings for search and group commands
async function buildCommonFilters(parsed: any): Promise<string[]> {
  const filters: string[] = [];

  // 1. Journal filter
  const journalKey = getOpt(parsed, "journal", "j");
  const ceramicsOnly = getOpt(parsed, "ceramics");
  if (journalKey) {
    const jKey = String(journalKey).toLowerCase();
    const journalInfo = CORE_JOURNALS[jKey];
    if (journalInfo) {
      filters.push(`primary_location.source.issn:${journalInfo.issns.join("|")}`);
    } else {
      console.warn(`${A.ye}Warning: Unknown journal key "${journalKey}".${A.r}`);
    }
  } else if (ceramicsOnly) {
    filters.push(`primary_location.source.issn:${ALL_CERAMIC_ISSNS}`);
  }

  // 2. Year range filter
  const year = getOpt(parsed, "year", "y");
  if (year) {
    const yearStr = String(year);
    if (yearStr.includes("-")) {
      const parts = yearStr.split("-");
      filters.push(`publication_year:${parts[0]}-${parts[1]}`);
    } else {
      filters.push(`publication_year:${yearStr}`);
    }
  }

  // 3. Open Access filter
  const oaOnly = getOpt(parsed, "oa");
  if (oaOnly) {
    filters.push("is_oa:true");
  }

  // 4. Document type filter
  const typeFilter = getOpt(parsed, "type", "t");
  if (typeFilter) {
    filters.push(`type:${String(typeFilter).toLowerCase()}`);
  }

  // 5. Language filter
  const langFilter = getOpt(parsed, "lang", "language");
  if (langFilter) {
    filters.push(`language:${String(langFilter).toLowerCase()}`);
  }

  // 6. Country filter
  const countryFilter = getOpt(parsed, "country", "c");
  if (countryFilter) {
    filters.push(`authorships.institutions.country_code:${String(countryFilter).toUpperCase()}`);
  }

  // 7. Institution filter
  const instFilter = getOpt(parsed, "inst");
  if (instFilter) {
    let instId = String(instFilter).trim();
    if (!instId.toUpperCase().startsWith("I")) {
      instId = `I${instId}`;
    }
    filters.push(`authorships.institutions.id:${instId.toUpperCase()}`);
  }

  // 8. Topic filter
  const topicFilter = getOpt(parsed, "topic");
  if (topicFilter) {
    let topicId = String(topicFilter).trim();
    if (!topicId.toUpperCase().startsWith("T")) {
      topicId = `T${topicId}`;
    }
    filters.push(`topics.id:${topicId.toUpperCase()}`);
  }

  // 9. Cites filter (citations tracing)
  const citesFilter = getOpt(parsed, "cites");
  if (citesFilter) {
    const targetWId = await resolveToWorkId(String(citesFilter));
    filters.push(`cites:${targetWId}`);
  }

  // 10. Batch DOI filter
  const doiFilter = getOpt(parsed, "doi");
  if (doiFilter) {
    const rawDois = String(doiFilter).split(/[|,]/).map(d => cleanDOI(d)).filter(Boolean);
    if (rawDois.length > 0) {
      const formattedDois = rawDois.map(d => `https://doi.org/${d}`).join("|");
      filters.push(`doi:${formattedDois}`);
    }
  }

  // 11. Minimum citation count filter
  const citedMin = getOpt(parsed, "cited-min");
  if (citedMin) {
    const n = parseInt(String(citedMin));
    if (!isNaN(n) && n >= 0) {
      filters.push(`cited_by_count:>${n - 1}`);
    }
  }

  return filters;
}

// -------------------------------------------------------------
// 1. Command handler: search
// -------------------------------------------------------------
async function handleSearch(parsed: any) {
  const query = getOpt(parsed, "query", "q");
  const limitRaw = parseInt(String(getOpt(parsed, "limit", "l") || "10"));
  const limit = Math.min(isNaN(limitRaw) ? 10 : limitRaw, 100);
  const pageRaw = parseInt(String(getOpt(parsed, "page", "p") || "1"));
  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
  const sortBy = getOpt(parsed, "sort", "s") || "citations";

  const filters = await buildCommonFilters(parsed);

  if (!query && filters.length === 0) {
    console.error(`${A.rd}Error: Missing search criteria. Specify query (-q) or at least one filter (--cites, --topic, --inst, --country, --doi, -j, --ceramics).${A.r}`);
    console.log(`Example: bun paper.ts search -q "alumina sintering" --ceramics`);
    console.log(`Example: bun paper.ts search --cites W2741809807 --lang en`);
    return;
  }

  const params: Record<string, string> = {
    per_page: String(limit),
    page: String(page)
  };

  if (query) {
    params.search = String(query);
  }

  if (filters.length > 0) {
    params.filter = filters.join(",");
  }

  if (sortBy === "year") {
    params.sort = "publication_year:desc,cited_by_count:desc";
  } else {
    params.sort = "cited_by_count:desc,publication_year:desc";
  }

  console.log(`${A.gr}Searching OpenAlex database...${A.r}`);
  if (openAlexApiKey) {
    console.log(`${A.gr}API Key enabled${A.r}`);
  }

  const result = await fetchOpenAlex("/works", params);
  const works = result?.results || [];

  if (works.length === 0) {
    console.log(`${A.ye}No academic papers matching the query were found.${A.r}`);
    return;
  }

  const ceramicsOnly = getOpt(parsed, "ceramics");
  const targetScope = ceramicsOnly ? "Core Ceramic Journals" : "Global Catalog";
  const totalCount = result?.meta?.count ?? works.length;
  const cardTitle = ` LITERATURE SEARCH (${targetScope}) - Page ${page} / Total ~${totalCount.toLocaleString()} `;

  const headers = ["ID / DOI", "Title", "Year", "Journal", "Cites", "Type", "OA"];
  const rows = works.map((w: any) => {
    const doiClean = w.doi ? cleanDOI(w.doi) : "";
    const idDisplay = doiClean 
      ? `${A.ye}${doiClean}${A.r}` 
      : `${A.ye}${w.id.replace("https://openalex.org/", "")}${A.r}`;

    const title = `${A.b}${w.title || "Untitled"}${A.r}`;
    const year = String(w.publication_year || "—");
    const sourceName = w.primary_location?.source?.display_name || "—";
    const cites = `${A.ye}${w.cited_by_count ?? 0}${A.r}`;
    const workType = (w.type || "—").toLowerCase();
    const oa = w.is_oa ? `${A.gn}OA${A.r}` : `${A.gr}No${A.r}`;

    return [idDisplay, title, year, sourceName, cites, workType, oa];
  });

  const termWidth = process.stdout.columns || 80;
  const maxTableWidth = Math.max(72, Math.min(110, termWidth - 10));

  const tableLines = getHorizontalTableLinesWrapped(headers, rows, maxTableWidth, A.wh, A.gn);
  printCardWithTables(cardTitle, [tableLines]);

  if (totalCount > page * limit) {
    console.log(`${A.gr}提示: 使用 -p ${page + 1} 查看下一页${A.r}\n`);
  }
}

// -------------------------------------------------------------
// 2. Command handler: group (aggregation statistics)
// -------------------------------------------------------------
async function handleGroup(parsed: any) {
  const query = getOpt(parsed, "query", "q");
  const rawBy = String(getOpt(parsed, "by") || "publication_year").toLowerCase();
  
  const fieldMap: Record<string, string> = {
    year: "publication_year",
    publication_year: "publication_year",
    type: "type",
    oa: "open_access.oa_status",
    oa_status: "open_access.oa_status",
    country: "authorships.institutions.country_code",
    journal: "primary_location.source.issn",
    issn: "primary_location.source.issn",
    topic: "topics.id",
    lang: "language",
    language: "language",
    inst: "authorships.institutions.id"
  };

  const groupByField = fieldMap[rawBy] || rawBy;
  const filters = await buildCommonFilters(parsed);

  if (!query && filters.length === 0) {
    console.error(`${A.rd}Error: Please specify query (-q) or at least one filter for aggregation analysis.${A.r}`);
    console.log(`Example: bun paper.ts group -q "sintering alumina" --by publication_year`);
    console.log(`Example: bun paper.ts group -q "zirconia" --by country`);
    return;
  }

  const params: Record<string, string> = {
    group_by: groupByField
  };

  if (query) params.search = String(query);
  if (filters.length > 0) params.filter = filters.join(",");

  console.log(`${A.gr}Computing OpenAlex aggregated statistics for group_by=${groupByField}...${A.r}`);
  
  const result = await fetchOpenAlex("/works", params);
  const groups: Array<{ key: string; key_display_name?: string; count: number }> = result?.group_by || [];

  if (groups.length === 0) {
    console.log(`${A.ye}No statistical records found for group_by=${groupByField}.${A.r}`);
    return;
  }

  const totalCount = groups.reduce((acc, g) => acc + g.count, 0);
  const cardTitle = ` GROUP-BY AGGREGATION ANALYSIS: ${groupByField} (Total indexed: ${totalCount.toLocaleString()}) `;

  const maxCount = Math.max(...groups.map(g => g.count));
  const headers = ["Category / Key", "Count", "Share", "Distribution Visual"];
  const displayGroups = groups.slice(0, 20);

  const rows = displayGroups.map(g => {
    let keyName = g.key_display_name || g.key || "Unknown";
    keyName = keyName.replace(/^https:\/\/openalex\.org\/(countries|topics)\//, "");
    
    const countStr = `${A.ye}${g.count.toLocaleString()}${A.r}`;
    const percent = totalCount > 0 ? (g.count / totalCount) * 100 : 0;
    const shareStr = `${percent.toFixed(1)}%`;
    
    const barRatio = maxCount > 0 ? g.count / maxCount : 0;
    const barWidth = Math.round(barRatio * 25);
    const visualBar = `${A.cy}${"█".repeat(barWidth)}${A.r}`;

    return [`${A.cy}${keyName}${A.r}`, countStr, shareStr, visualBar];
  });

  const termWidth = process.stdout.columns || 80;
  const maxTableWidth = Math.max(72, Math.min(100, termWidth - 10));

  const tableLines = getHorizontalTableLinesWrapped(headers, rows, maxTableWidth, A.wh, A.gn);
  printCardWithTables(cardTitle, [tableLines]);

  if (groups.length > 20) {
    console.log(`${A.gr}Showing top 20 of ${groups.length} groups.${A.r}\n`);
  }
}

// -------------------------------------------------------------
// 3. Command handler: topics (active topic search)
// -------------------------------------------------------------
async function handleTopics(parsed: any) {
  const query = getOpt(parsed, "query", "q") || parsed.positional[0];
  const limitRaw = parseInt(String(getOpt(parsed, "limit", "l") || "10"));
  const limit = Math.min(isNaN(limitRaw) ? 10 : limitRaw, 50);

  if (!query) {
    console.error(`${A.rd}Error: Missing topic search keyword.${A.r}`);
    console.log(`Example: bun paper.ts topics "sintering"`);
    return;
  }

  console.log(`${A.gr}Searching OpenAlex topic system for: "${query}"...${A.r}`);

  const params: Record<string, string> = {
    search: String(query),
    per_page: String(limit)
  };

  const result = await fetchOpenAlex("/topics", params);
  const topics = result?.results || [];

  if (topics.length === 0) {
    console.log(`${A.ye}No topics matching "${query}" were found.${A.r}`);
    return;
  }

  const totalCount = result?.meta?.count || topics.length;
  const cardTitle = ` OPENALEX TOPIC CLASSIFICATION SYSTEM (Found ${totalCount} topics) `;

  const headers = ["Topic ID", "Topic Name", "Subfield", "Field", "Works Count"];
  const rows = topics.map((t: any) => {
    const idShort = `${A.ye}${t.id ? t.id.replace("https://openalex.org/", "") : "—"}${A.r}`;
    const name = `${A.b}${t.display_name || "—"}${A.r}`;
    const subfield = t.subfield?.display_name || "—";
    const field = t.field?.display_name || "—";
    const count = `${A.ye}${(t.works_count ?? 0).toLocaleString()}${A.r}`;

    return [idShort, name, subfield, field, count];
  });

  const termWidth = process.stdout.columns || 80;
  const maxTableWidth = Math.max(72, Math.min(110, termWidth - 10));

  const tableLines = getHorizontalTableLinesWrapped(headers, rows, maxTableWidth, A.wh, A.gn);
  printCardWithTables(cardTitle, [tableLines]);
  console.log(`${A.gr}提示: 使用 bun paper.ts search --topic <TopicID> 进行该主题精准文献检索${A.r}\n`);
}

// -------------------------------------------------------------
// 4. Command handler: inst (active institution search)
// -------------------------------------------------------------
async function handleInst(parsed: any) {
  const query = getOpt(parsed, "query", "q") || parsed.positional[0];
  const limitRaw = parseInt(String(getOpt(parsed, "limit", "l") || "10"));
  const limit = Math.min(isNaN(limitRaw) ? 10 : limitRaw, 50);

  if (!query) {
    console.error(`${A.rd}Error: Missing institution search keyword.${A.r}`);
    console.log(`Example: bun paper.ts inst "Jingdezhen"`);
    return;
  }

  console.log(`${A.gr}Searching OpenAlex institution database for: "${query}"...${A.r}`);

  const params: Record<string, string> = {
    search: String(query),
    per_page: String(limit)
  };

  const result = await fetchOpenAlex("/institutions", params);
  const insts = result?.results || [];

  if (insts.length === 0) {
    console.log(`${A.ye}No institutions matching "${query}" were found.${A.r}`);
    return;
  }

  const totalCount = result?.meta?.count || insts.length;
  const cardTitle = ` OPENALEX INSTITUTION SEARCH (Found ${totalCount} institutions) `;

  const headers = ["Inst ID", "Institution Name", "Country", "Type", "Works Count"];
  const rows = insts.map((i: any) => {
    const idShort = `${A.ye}${i.id ? i.id.replace("https://openalex.org/", "") : "—"}${A.r}`;
    const name = `${A.b}${i.display_name || "—"}${A.r}`;
    const country = i.country_code || "—";
    const type = i.type || "—";
    const count = `${A.ye}${(i.works_count ?? 0).toLocaleString()}${A.r}`;

    return [idShort, name, country, type, count];
  });

  const termWidth = process.stdout.columns || 80;
  const maxTableWidth = Math.max(72, Math.min(110, termWidth - 10));

  const tableLines = getHorizontalTableLinesWrapped(headers, rows, maxTableWidth, A.wh, A.gn);
  printCardWithTables(cardTitle, [tableLines]);
  console.log(`${A.gr}提示: 使用 bun paper.ts search --inst <InstID> 或 --country <CountryCode> 进行机构产出检索${A.r}\n`);
}

// -------------------------------------------------------------
// 5. Command handler: info (single or batch paper card)
// -------------------------------------------------------------
async function handleInfo(parsed: any) {
  const rawTargets = parsed.positional.flatMap(arg => arg.split(/[|,]/)).map(s => s.trim()).filter(Boolean);

  if (rawTargets.length === 0) {
    console.error(`${A.rd}Error: Missing DOI or OpenAlex ID argument.${A.r}`);
    console.log(`Example: bun paper.ts info 10.1111/jace.19034`);
    console.log(`Example: bun paper.ts info 10.1111/jace.19034 10.1016/j.jeurceramsoc.2021.01.001 --save report.md`);
    return;
  }

  if (rawTargets.length === 1) {
    const targetId = rawTargets[0];
    console.log(`${A.gr}Retrieving paper details for: ${targetId}...${A.r}`);

    const work = await fetchSingleWork(targetId);

    if (!work) {
      console.error(`${A.rd}Error: Paper with ID/DOI "${targetId}" not found in database.${A.r}`);
      return;
    }

    printSingleWorkCard(work);
    saveReportIfRequested(parsed, [work]);
    return;
  }

  // Batch lookup for multiple DOIs / OpenAlex IDs
  console.log(`${A.gr}Retrieving batch paper details for ${rawTargets.length} items...${A.r}`);

  const works: any[] = [];
  const dois: string[] = [];
  const wIds: string[] = [];

  for (const t of rawTargets) {
    if (t.match(/^W\d+$/i)) {
      wIds.push(t.toUpperCase());
    } else {
      dois.push(cleanDOI(t));
    }
  }

  if (dois.length > 0) {
    const doiFilters = dois.map(d => `https://doi.org/${d}`).join("|");
    const res = await fetchOpenAlex("/works", { filter: `doi:${doiFilters}`, per_page: String(Math.min(dois.length, 100)) });
    if (res?.results) works.push(...res.results);
  }

  if (wIds.length > 0) {
    const wFilters = wIds.join("|");
    const res = await fetchOpenAlex("/works", { filter: `openalex:${wFilters}`, per_page: String(Math.min(wIds.length, 100)) });
    if (res?.results) works.push(...res.results);
  }

  if (works.length === 0) {
    console.error(`${A.rd}Error: None of the requested papers were found in database.${A.r}`);
    return;
  }

  const cardTitle = ` BATCH ACADEMIC LITERATURE CARDS (Found ${works.length} of ${rawTargets.length} requested) `;
  
  const headers = ["ID / DOI", "Title", "Year", "Journal", "Cites", "OA"];
  const rows = works.map((w: any) => {
    const doiClean = w.doi ? cleanDOI(w.doi) : "";
    const idDisplay = doiClean ? `${A.ye}${doiClean}${A.r}` : `${A.ye}${w.id.replace("https://openalex.org/", "")}${A.r}`;
    const title = `${A.b}${w.title || "Untitled"}${A.r}`;
    const year = String(w.publication_year || "—");
    const jName = w.primary_location?.source?.display_name || "—";
    const cites = `${A.ye}${w.cited_by_count ?? 0}${A.r}`;
    const oa = w.is_oa ? `${A.gn}OA${A.r}` : `${A.gr}No${A.r}`;
    return [idDisplay, title, year, jName, cites, oa];
  });

  const termWidth = process.stdout.columns || 80;
  const maxTableWidth = Math.max(72, Math.min(110, termWidth - 10));

  const tableLines = getHorizontalTableLinesWrapped(headers, rows, maxTableWidth, A.wh, A.gn);
  printCardWithTables(cardTitle, [tableLines]);

  works.forEach(w => printSingleWorkCard(w));
  saveReportIfRequested(parsed, works);
}

// Print single work card layout
function printSingleWorkCard(work: any) {
  const authors = (work.authorships || []).map((a: any) => {
    const name = a.author?.display_name || "Unknown Author";
    const instName = a.institutions?.[0]?.display_name;
    const country = a.institutions?.[0]?.country_code;
    const instStr = instName ? ` (${instName}${country ? ", " + country : ""})` : "";
    return `${name}${instStr}`;
  }).join(", ");

  const abstractText = reconstructAbstract(work.abstract_inverted_index);

  const topics: string[] = (work.topics || []).slice(0, 5).map((t: any) => {
    const domain = t.domain?.display_name || "";
    const field = t.field?.display_name || "";
    const name = t.display_name || "";
    return `${name} [${field}${domain ? " › " + domain : ""}]`;
  });

  const allLocations: any[] = work.locations || [];
  const pdfUrl = work.primary_location?.pdf_url
    || allLocations.find((l: any) => l.pdf_url)?.pdf_url
    || null;

  const termWidth = process.stdout.columns || 80;
  const maxTableWidth = Math.max(72, Math.min(100, termWidth - 10));

  // Table 1: Core Metadata
  const metaHeaders = ["Property", "Details"];
  const metaRows: string[][] = [
    ["Title", `${A.b}${work.title || "Untitled"}${A.r}`],
    ["Type", work.type || "—"],
    ["Authors", authors || "—"],
    ["Source Journal", (work.primary_location?.source?.display_name || "—") + (work.primary_location?.source?.issn ? ` (ISSN: ${work.primary_location.source.issn.join(", ")})` : "")],
    ["Pub Date", `${work.publication_date || "—"} (Year: ${work.publication_year || "—"})`],
    ["Citations", `${A.ye}${work.cited_by_count ?? 0}${A.r} citations`],
    ["Open Access", work.is_oa ? `${A.gn}Yes (Free full text available)${A.r}` : `${A.gr}No (Paywalled)${A.r}`],
    ["Landing Page", work.primary_location?.landing_page_url || work.doi || "—"],
  ];
  if (pdfUrl) {
    metaRows.push(["PDF Link", `${A.u}${A.cy}${pdfUrl}${A.r}`]);
  }

  const metaTable = getHorizontalTableLinesWrapped(metaHeaders, metaRows, maxTableWidth, A.wh, A.gn);

  const tableBlocks: string[][] = [metaTable];

  // Table 2: Topics (if available)
  if (topics.length > 0) {
    const topicHeaders = ["#", "Topic & Domain Classification"];
    const topicRows = topics.map((t, i) => [`${i + 1}`, t]);
    const topicTable = getHorizontalTableLinesWrapped(topicHeaders, topicRows, maxTableWidth, A.wh, A.gn);
    tableBlocks.push(topicTable);
  }

  // Table 3: Abstract (if available)
  if (abstractText) {
    const abstractHeaders = ["Abstract"];
    const abstractTable = getHorizontalTableLinesWrapped(abstractHeaders, [[abstractText]], maxTableWidth, A.wh, A.gn);
    tableBlocks.push(abstractTable);
  }

  const workIdShort = work.id ? work.id.replace("https://openalex.org/", "") : "CARD";
  const cardTitle = ` ACADEMIC LITERATURE CARD (${workIdShort}) `;
  printCardWithTables(cardTitle, tableBlocks);
}

// Save markdown report helper
function saveReportIfRequested(parsed: any, works: any[]) {
  const savePath = getOpt(parsed, "save");
  if (!savePath) return;

  let filename = typeof savePath === "string" ? savePath : (
    works.length === 1 
      ? `${(works[0].title || "paper").toLowerCase().replace(/[^a-z0-9]+/g, "_").substring(0, 30)}.md`
      : `batch_paper_report_${Date.now()}.md`
  );
  if (!filename.endsWith(".md")) filename += ".md";

  let report = `# Academic Literature Report (${works.length} ${works.length === 1 ? "Paper" : "Papers"})\n\n`;
  report += `* Generated at: ${new Date().toISOString()}\n\n`;

  works.forEach((work, idx) => {
    const authors = (work.authorships || []).map((a: any) => {
      const name = a.author?.display_name || "Unknown Author";
      const instName = a.institutions?.[0]?.display_name;
      const country = a.institutions?.[0]?.country_code;
      return `${name}${instName ? ` (${instName}${country ? ", " + country : ""})` : ""}`;
    }).join(", ");

    const abstractText = reconstructAbstract(work.abstract_inverted_index);
    const topics = (work.topics || []).slice(0, 5).map((t: any) => `${t.display_name} [${t.field?.display_name || ""} › ${t.domain?.display_name || ""}]`);
    const allLocations: any[] = work.locations || [];
    const pdfUrl = work.primary_location?.pdf_url || allLocations.find((l: any) => l.pdf_url)?.pdf_url || null;

    if (works.length > 1) {
      report += `## ${idx + 1}. ${work.title}\n\n`;
    } else {
      report += `## Paper Metadata: ${work.title}\n\n`;
    }
    report += `* **Title**: ${work.title}\n`;
    report += `* **OpenAlex ID**: ${work.id}\n`;
    report += `* **DOI**: ${work.doi || "N/A"}\n`;
    report += `* **Type**: ${work.type || "N/A"}\n`;
    report += `* **Authors**: ${authors}\n`;
    report += `* **Journal**: ${work.primary_location?.source?.display_name || "N/A"}\n`;
    report += `* **Publication Date**: ${work.publication_date}\n`;
    report += `* **Citations**: ${work.cited_by_count} citations\n`;
    report += `* **Open Access**: ${work.is_oa ? "Yes" : "No"}\n`;
    report += `* **Landing Page**: ${work.primary_location?.landing_page_url || work.doi || "N/A"}\n`;
    if (pdfUrl) report += `* **PDF URL**: ${pdfUrl}\n`;
    if (topics.length > 0) {
      report += `\n### Topics\n\n`;
      topics.forEach((t, i) => { report += `${i + 1}. ${t}\n`; });
    }
    report += `\n### Abstract\n\n${abstractText}\n\n---\n\n`;
  });

  try {
    writeFileSync(filename, report, "utf8");
    console.log(`${A.gn}${A.b}[Success] Literature report saved successfully to: ${filename}${A.r}\n`);
  } catch (e: any) {
    console.error(`${A.rd}Failed to save report file: ${e.message}${A.r}`);
  }
}

// -------------------------------------------------------------
// 6. Command handler: download
// -------------------------------------------------------------
async function handleDownload(parsed: any) {
  if (parsed.positional.length === 0) {
    console.error(`${A.rd}Error: Missing DOI or OpenAlex ID argument.${A.r}`);
    console.log(`Example: bun paper.ts download 10.1111/jace.19034`);
    return;
  }

  const targetId = parsed.positional[0].trim();
  console.log(`${A.gr}Retrieving full-text access links for: ${targetId}...${A.r}`);

  const work = await fetchSingleWork(targetId);

  if (!work) {
    console.error(`${A.rd}Error: Paper with ID/DOI "${targetId}" not found in database.${A.r}`);
    return;
  }

  const allLocs: any[] = work.locations || [];
  const pdfUrl: string | null = work.primary_location?.pdf_url
    || allLocs.find((l: any) => l.pdf_url)?.pdf_url
    || null;
  
  if (!pdfUrl) {
    console.error(`${A.rd}Error: Direct PDF download URL is not available for this article.${A.r}`);
    console.log(`Landing page: ${work.primary_location?.landing_page_url || work.doi || "N/A"}`);
    if (!work.is_oa) {
      console.log(`This paper is paywalled. You may need to access it via institutional library login.`);
    } else {
      console.log(`This is an open access paper but no direct PDF link was indexed. Try accessing it on landing page.`);
    }
    return;
  }

  let outputFilename = getOpt(parsed, "output", "o");
  if (!outputFilename || typeof outputFilename !== "string") {
    const slug = work.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .substring(0, 30);
    outputFilename = `${slug}_${work.id.replace("https://openalex.org/", "")}.pdf`;
  }

  console.log(`${A.cy}Found PDF download link: ${pdfUrl}${A.r}`);
  console.log(`${A.gr}Downloading PDF to ${outputFilename}...${A.r}`);

  try {
    const response = await fetch(pdfUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; paper-ts/1.0)"
      }
    });

    if (!response.ok) {
      throw new Error(`Download request failed with status: ${response.status} - ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(outputFilename, buffer);

    console.log(`${A.gn}${A.b}[Success] PDF downloaded successfully! Saved as: ${outputFilename}${A.r}\n`);
  } catch (error: any) {
    console.error(`${A.rd}Failed to download PDF: ${error.message}${A.r}`);
    console.log(`You can still download it manually from the URL: ${pdfUrl}`);
  }
}

// Execute main process
main();

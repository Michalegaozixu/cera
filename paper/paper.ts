import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Define paths
const ENV_PATH = join(import.meta.dirname, ".env");

// Load .env file from the script directory manually
let politeEmail = "";
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
      if (key === "POLITE_EMAIL") {
        politeEmail = valClean;
      }
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

// Color codes for premium terminal layout
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  underline: "\x1b[4m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m"
};

// Main process
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    return;
  }

  const command = args[0].toLowerCase();
  
  if (command !== "search" && command !== "info" && command !== "download") {
    console.error(`${colors.red}Error: Unknown command "${command}"${colors.reset}\n`);
    printUsage();
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
    }
  } catch (error: any) {
    console.error(`${colors.red}Error executing command: ${error.message || error}${colors.reset}`);
  }
}

// Print usage manual
function printUsage() {
  console.log(`${colors.bold}${colors.cyan}================================================================================`);
  console.log(`               Ceramic Intelligence System: 学术论文检索工具 (TS CLI)`);
  console.log(`================================================================================${colors.reset}`);
  console.log(`使用方法:`);
  console.log(`  bun paper.ts <命令> [参数/选项]\n`);
  console.log(`命令列表:`);
  console.log(`  ${colors.bold}search${colors.reset}       多条件搜索论文文献列表`);
  console.log(`  ${colors.bold}info${colors.reset}         查询指定 DOI 或 OpenAlex ID 的论文详细卡片与重构摘要`);
  console.log(`  ${colors.bold}download${colors.reset}     直接下载 Open Access 的免费 PDF 原文到本地\n`);
  
  console.log(`命令详解与示例:\n`);
  
  console.log(`1. ${colors.cyan}search (搜索)${colors.reset}`);
  console.log(`   选项:`);
  console.log(`     -q, --query <关键词>        搜索词，如 "sintering alumina"`);
  console.log(`     -j, --journal <期刊代号>    限定期刊 (代号见下方对照表)`);
  console.log(`     --ceramics                  只在预设的陶瓷核心期刊列表中检索`);
  console.log(`     -y, --year <年份范围>       出版年份或范围 (如 "2024" 或 "2020-2026")`);
  console.log(`     --oa                        仅筛选开放获取 (Open Access) 的免费文献`);
  console.log(`     -l, --limit <数量>          返回文献数上限 (默认 10)`);
  console.log(`     -s, --sort <排序规则>       citations (默认, 按被引降序) 或 year (按年份降序)`);
  console.log(`   示例:`);
  console.log(`     bun paper.ts search -q "glaze thermal expansion" --ceramics`);
  console.log(`     bun paper.ts search -q "solid state sintering" -j jacs -y 2022-2026\n`);
  
  console.log(`2. ${colors.cyan}info (精读)${colors.reset}`);
  console.log(`   参数: <DOI> 或 <OpenAlex_ID> (OpenAlex ID 格式如 W4388123456)`);
  console.log(`   选项:`);
  console.log(`     --save [文件名]             将文献卡片及重构好的摘要保存为本地 Markdown 报告`);
  console.log(`   示例:`);
  console.log(`     bun paper.ts info 10.1111/jace.19034`);
  console.log(`     bun paper.ts info W4316223405 --save result.md\n`);
  
  console.log(`3. ${colors.cyan}download (下载全文)${colors.reset}`);
  console.log(`   参数: <DOI> 或 <OpenAlex_ID>`);
  console.log(`   选项:`);
  console.log(`     -o, --output <文件名>       指定下载的 PDF 保存的文件名`);
  console.log(`   示例:`);
  console.log(`     bun paper.ts download 10.1111/jace.19034`);
  console.log(`     bun paper.ts download W4316223405 -o paper_fulltext.pdf\n`);
  
  console.log(`期刊代号对照表:`);
  for (const [key, val] of Object.entries(CORE_JOURNALS)) {
    console.log(`  ${colors.bold}${key.padEnd(8)}${colors.reset} : ${val.name}`);
  }
  console.log();
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

// Print title wrapper
function printTitle(title: string) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${title} ===${colors.reset}`);
}

// Strip ANSI codes for text width calculation
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

// Pad string based on visible length (ignores ANSI codes)
function padString(str: string, width: number): string {
  const visibleLength = stripAnsi(str).length;
  const paddingLength = Math.max(0, width - visibleLength);
  return str + " ".repeat(paddingLength);
}

// Draw formatted table in console
function printTable(headers: string[], rows: string[][]) {
  if (rows.length === 0) return;
  const widths = headers.map((h, i) => {
    return Math.max(h.length, ...rows.map(r => stripAnsi(r[i] || "").length));
  });

  const headerLine = headers.map((h, i) => padString(h, widths[i])).join(" | ");
  console.log(`${colors.bold}${colors.gray}${headerLine}${colors.reset}`);
  console.log(widths.map(w => "-".repeat(w)).join("-|-"));

  for (const row of rows) {
    const line = row.map((val, i) => padString(val, widths[i])).join(" | ");
    console.log(line);
  }
  console.log();
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
  const urlParams = new URLSearchParams(params);
  const url = `${BASE_URL}${path}?${urlParams.toString()}`;
  
  const headers: Record<string, string> = {
    "accept": "application/json"
  };

  // Add email for OpenAlex polite pool if configured
  if (politeEmail) {
    headers["User-Agent"] = `mailto:${politeEmail}`;
  }

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
    // OpenAlex ID
    path = `/works/${cleaned.toUpperCase()}`;
  } else {
    // DOI
    const doi = cleanDOI(cleaned);
    path = `/works/https://doi.org/${doi}`;
  }

  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "accept": "application/json"
  };
  if (politeEmail) {
    headers["User-Agent"] = `mailto:${politeEmail}`;
  }

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

// -------------------------------------------------------------
// 1. Command handler: search
// -------------------------------------------------------------
async function handleSearch(parsed: any) {
  const query = getOpt(parsed, "query", "q");
  const journalKey = getOpt(parsed, "journal", "j");
  const ceramicsOnly = getOpt(parsed, "ceramics");
  const year = getOpt(parsed, "year", "y");
  const oaOnly = getOpt(parsed, "oa");
  const limit = getOpt(parsed, "limit", "l") || "10";
  const sortBy = getOpt(parsed, "sort", "s") || "citations";

  if (!query) {
    console.error(`${colors.red}Error: Missing query string. Please specify -q or --query.${colors.reset}`);
    console.log(`Example: bun paper.ts search -q "alumina sintering" --ceramics`);
    return;
  }

  const params: Record<string, string> = {
    per_page: String(limit)
  };

  // Build filter list
  const filters: string[] = [];
  
  // 1. Query search
  params.search = String(query);

  // 2. Journal filtering
  if (journalKey) {
    const jKey = String(journalKey).toLowerCase();
    const journalInfo = CORE_JOURNALS[jKey];
    if (journalInfo) {
      filters.push(`primary_location.source.issn:${journalInfo.issns.join("|")}`);
    } else {
      console.warn(`${colors.yellow}Warning: Unknown journal key "${journalKey}". Search will be global.${colors.reset}`);
    }
  } else if (ceramicsOnly) {
    filters.push(`primary_location.source.issn:${ALL_CERAMIC_ISSNS}`);
  }

  // 3. Year range filtering
  if (year) {
    const yearStr = String(year);
    if (yearStr.includes("-")) {
      const parts = yearStr.split("-");
      filters.push(`publication_year:${parts[0]}-${parts[1]}`);
    } else {
      filters.push(`publication_year:${yearStr}`);
    }
  }

  // 4. Open Access filtering
  if (oaOnly) {
    filters.push("is_oa:true");
  }

  if (filters.length > 0) {
    params.filter = filters.join(",");
  }

  // 5. Sorting
  if (sortBy === "year") {
    params.sort = "publication_year:desc,cited_by_count:desc";
  } else {
    params.sort = "cited_by_count:desc,publication_year:desc";
  }

  console.log(`${colors.gray}Searching OpenAlex database...${colors.reset}`);
  if (politeEmail) {
    console.log(`${colors.gray}Polite pool enabled: User-Agent set with ${politeEmail}${colors.reset}`);
  }

  const result = await fetchOpenAlex("/works", params);
  const works = result?.results || [];

  if (works.length === 0) {
    console.log(`${colors.yellow}No academic papers matching the query were found.${colors.reset}`);
    return;
  }

  const targetTitle = ceramicsOnly 
    ? "LITERATURE SEARCH (Core Ceramic Journals)" 
    : "LITERATURE SEARCH (Global Catalog)";
  printTitle(`${targetTitle} - ${works.length} results`);

  const headers = ["ID / DOI", "Title", "Year", "Journal", "Cites", "OA"];
  const rows = works.map((w: any) => {
    // Determine ID display preference (DOI if available, otherwise OpenAlex ID)
    const doiClean = w.doi ? cleanDOI(w.doi) : "";
    const idDisplay = doiClean 
      ? colors.yellow + doiClean + colors.reset 
      : colors.yellow + w.id.replace("https://openalex.org/", "") + colors.reset;

    const title = colors.bold + (w.title?.length > 55 ? w.title.substring(0, 52) + "..." : w.title) + colors.reset;
    const year = String(w.publication_year || "N/A");
    
    // Get Source Journal Name
    const sourceName = w.primary_location?.source?.display_name || "N/A";
    const jName = sourceName.length > 25 ? sourceName.substring(0, 22) + "..." : sourceName;
    
    const cites = String(w.cited_by_count ?? 0);
    const oa = w.is_oa ? `${colors.green}Yes (PDF)${colors.reset}` : `${colors.gray}No${colors.reset}`;

    return [idDisplay, title, year, jName, cites, oa];
  });

  printTable(headers, rows);
}

// -------------------------------------------------------------
// 2. Command handler: info
// -------------------------------------------------------------
async function handleInfo(parsed: any) {
  if (parsed.positional.length === 0) {
    console.error(`${colors.red}Error: Missing DOI or OpenAlex ID argument.${colors.reset}`);
    console.log(`Example: bun paper.ts info 10.1111/jace.19034`);
    return;
  }

  const targetId = parsed.positional[0].trim();
  console.log(`${colors.gray}Retrieving paper details for: ${targetId}...${colors.reset}`);

  const work = await fetchSingleWork(targetId);

  if (!work) {
    console.error(`${colors.red}Error: Paper with ID/DOI "${targetId}" not found in database.${colors.reset}`);
    return;
  }

  // Format authors listing
  const authors = (work.authorships || []).map((a: any) => {
    const name = a.author?.display_name || "Unknown Author";
    const instName = a.institutions?.[0]?.display_name;
    const country = a.institutions?.[0]?.country_code;
    const instStr = instName ? ` (${instName}${country ? ", " + country : ""})` : "";
    return `${name}${instStr}`;
  }).join(", ");

  const abstractText = reconstructAbstract(work.abstract_inverted_index);

  // Print console layout
  console.log(`\n${colors.bold}${colors.cyan}================================================================================`);
  console.log(`                        ACADEMIC LITERATURE CARD`);
  console.log(`================================================================================${colors.reset}`);
  console.log(`  Title           : ${colors.bold}${work.title}${colors.reset}`);
  console.log(`  Authors         : ${authors || "N/A"}`);
  console.log(`  Source Journal  : ${work.primary_location?.source?.display_name || "N/A"}`);
  if (work.primary_location?.source?.issn) {
    console.log(`  ISSN            : ${work.primary_location.source.issn.join(", ")}`);
  }
  console.log(`  Pub Date        : ${work.publication_date || "N/A"} (Year: ${work.publication_year || "N/A"})`);
  console.log(`  Citations       : ${colors.bold}${work.cited_by_count ?? 0} citations${colors.reset}`);
  console.log(`  Open Access     : ${work.is_oa ? colors.green + "Yes (Free full text available)" + colors.reset : colors.gray + "No (Paywalled)" + colors.reset}`);
  console.log(`  Landing Page    : ${work.primary_location?.landing_page_url || work.doi || "N/A"}`);
  if (work.primary_location?.pdf_url) {
    console.log(`  Direct PDF Link : ${colors.underline}${colors.green}${work.primary_location.pdf_url}${colors.reset}`);
  }

  console.log(`\n${colors.bold}${colors.magenta}----------------------------------- ABSTRACT -----------------------------------${colors.reset}`);
  // Word wrap abstract for clean display
  console.log(wordWrap(abstractText, 80));
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

  // Handle Save to file
  const savePath = getOpt(parsed, "save");
  if (savePath) {
    let filename = typeof savePath === "string" ? savePath : `${work.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.md`;
    if (!filename.endsWith(".md")) filename += ".md";
    
    let report = `# Academic Literature Report: ${work.title}\n\n`;
    report += `* **Title**: ${work.title}\n`;
    report += `* **Authors**: ${authors}\n`;
    report += `* **Journal**: ${work.primary_location?.source?.display_name || "N/A"}\n`;
    report += `* **Date**: ${work.publication_date}\n`;
    report += `* **Citations**: ${work.cited_by_count} citations\n`;
    report += `* **Open Access**: ${work.is_oa ? "Yes" : "No"}\n`;
    report += `* **Landing URL**: ${work.primary_location?.landing_page_url || work.doi || "N/A"}\n`;
    if (work.primary_location?.pdf_url) {
      report += `* **PDF URL**: ${work.primary_location.pdf_url}\n`;
    }
    report += `\n## Abstract\n\n${abstractText}\n`;

    try {
      writeFileSync(filename, report, "utf8");
      console.log(`${colors.green}${colors.bold}[Success] Literature report saved successfully to: ${filename}${colors.reset}\n`);
    } catch (e: any) {
      console.error(`${colors.red}Failed to save report file: ${e.message}${colors.reset}`);
    }
  }
}

// Simple word wrap helper for console formatting
function wordWrap(text: string, limit: number): string {
  const words = text.split(" ");
  let currentLine = "";
  const lines: string[] = [];

  for (const word of words) {
    if ((currentLine + word).length > limit) {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  }
  if (currentLine) {
    lines.push(currentLine.trim());
  }
  return lines.join("\n");
}

// -------------------------------------------------------------
// 3. Command handler: download
// -------------------------------------------------------------
async function handleDownload(parsed: any) {
  if (parsed.positional.length === 0) {
    console.error(`${colors.red}Error: Missing DOI or OpenAlex ID argument.${colors.reset}`);
    console.log(`Example: bun paper.ts download 10.1111/jace.19034`);
    return;
  }

  const targetId = parsed.positional[0].trim();
  console.log(`${colors.gray}Retrieving full-text access links for: ${targetId}...${colors.reset}`);

  const work = await fetchSingleWork(targetId);

  if (!work) {
    console.error(`${colors.red}Error: Paper with ID/DOI "${targetId}" not found in database.${colors.reset}`);
    return;
  }

  const pdfUrl = work.primary_location?.pdf_url;
  
  if (!pdfUrl) {
    console.error(`${colors.red}Error: Direct PDF download URL is not available for this article.${colors.reset}`);
    console.log(`Landing page: ${work.primary_location?.landing_page_url || work.doi || "N/A"}`);
    if (!work.is_oa) {
      console.log(`This paper is paywalled. You may need to access it via institutional library login.`);
    } else {
      console.log(`This is an open access paper but no direct PDF link was indexed. Try accessing it on landing page.`);
    }
    return;
  }

  // Determine output filename
  let outputFilename = getOpt(parsed, "output", "o");
  if (!outputFilename || typeof outputFilename !== "string") {
    // create a sanitized slug from the title
    const slug = work.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .substring(0, 30);
    outputFilename = `${slug}_${work.id.replace("https://openalex.org/", "")}.pdf`;
  }

  console.log(`${colors.cyan}Found PDF download link: ${pdfUrl}${colors.reset}`);
  console.log(`${colors.gray}Downloading PDF to ${outputFilename}...${colors.reset}`);

  try {
    const response = await fetch(pdfUrl, {
      method: "GET",
      headers: {
        "User-Agent": politeEmail ? `mailto:${politeEmail}` : "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });

    if (!response.ok) {
      throw new Error(`Download request failed with status: ${response.status} - ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(outputFilename, buffer);

    console.log(`${colors.green}${colors.bold}[Success] PDF downloaded successfully! Saved as: ${outputFilename}${colors.reset}\n`);
  } catch (error: any) {
    console.error(`${colors.red}Failed to download PDF: ${error.message}${colors.reset}`);
    console.log(`You can still download it manually from the URL: ${pdfUrl}`);
  }
}

// Execute main process
main();

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

// Color codes for terminal layout
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
  const command = args[0]?.toLowerCase();

  if (!command || ["help", "-h", "--help"].includes(command)) {
    printHelp();
    return;
  }

  const validCommands = [
    "search", "info", "download", "group", "stats", 
    "topics", "topic", "inst", "institution", "institutions"
  ];

  if (!validCommands.includes(command)) {
    console.error(`${colors.red}Error: Unknown command "${command}".${colors.reset}`);
    printHelp();
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
    console.error(`${colors.red}Error: ${error.message || error}${colors.reset}`);
  }
}

// Print help documentation
function printHelp() {
  console.log(`
${colors.bold}${colors.cyan}OpenAlex Academic Paper Search Tool (paper.ts)${colors.reset}
${colors.gray}Tailored for Ceramic & Materials Science Research${colors.reset}

${colors.bold}USAGE:${colors.reset}
  bun paper.ts <command> [options]

${colors.bold}COMMANDS:${colors.reset}
  ${colors.bold}search${colors.reset}       Search literature database with filters (keyword, journal, year, cites, topic, etc.)
  ${colors.bold}group${colors.reset}        Aggregation statistics & distribution trends (year, country, type, journal, topic, etc.)
  ${colors.bold}topics${colors.reset}       Search OpenAlex Topic classification system by keyword
  ${colors.bold}inst${colors.reset}         Search OpenAlex Institution database by keyword
  ${colors.bold}info${colors.reset}         Get detailed card info for single or batch DOIs / OpenAlex IDs
  ${colors.bold}download${colors.reset}     Download Open Access (OA) PDF full-text to local disk

${colors.bold}SEARCH & GROUP OPTIONS:${colors.reset}
  -q, --query <text>       Search query string
  -j, --journal <key>      Filter by ceramic core journal key (jacs, jecs, ci, jac, jncs, solgel, acta)
  --ceramics               Filter by all core ceramic journals
  -y, --year <year|range>  Filter publication year (e.g. 2024 or 2020-2026)
  --oa                     Filter Open Access works only
  -t, --type <type>        Filter work type (article, review, book-chapter, preprint, etc.)
  --lang <code\>            Filter language (e.g. en, zh, ja)
  -c, --country <code\>     Filter author institution country code (e.g. CN, US, DE)
  --inst <ID\>              Filter author institution OpenAlex ID (e.g. I105991555)
  --topic <ID\>             Filter topic OpenAlex ID (e.g. T10132)
  --cites <ID|DOI>         Search works citing a given paper (e.g. W2741809807 or 10.1111/jace.19034)
  --doi <DOIs>             Filter single or pipe/comma separated DOIs
  --cited-min <n>          Filter minimum citation count
  -l, --limit <n>          Page limit (default 10, max 100)
  -p, --page <n>           Page number (default 1)
  -s, --sort <citations|year> Sort order (default citations)
  --by <field>             [group only] Grouping field: year (default), type, oa, country, journal, topic, lang

${colors.bold}EXAMPLES:${colors.reset}
  bun paper.ts search -q "alumina sintering" --ceramics --lang en
  bun paper.ts search --cites W2741809807 -s year
  bun paper.ts search --topic T10132 -c CN -y 2022-2026
  bun paper.ts group -q "sintering" --by year
  bun paper.ts group -q "porcelain" --by country
  bun paper.ts topics "sintering alumina"
  bun paper.ts inst "Jingdezhen"
  bun paper.ts info 10.1111/jace.19034 10.1016/j.jeurceramsoc.2021.01.001 --save batch_report.md
  bun paper.ts download W4319030111 -o laser_ceramics.pdf
`);
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
      console.warn(`${colors.yellow}Warning: Unknown journal key "${journalKey}".${colors.reset}`);
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
    console.error(`${colors.red}Error: Missing search criteria. Specify query (-q) or at least one filter (--cites, --topic, --inst, --country, --doi, -j, --ceramics).${colors.reset}`);
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

  console.log(`${colors.gray}Searching OpenAlex database...${colors.reset}`);
  if (openAlexApiKey) {
    console.log(`${colors.gray}API Key enabled${colors.reset}`);
  }

  const result = await fetchOpenAlex("/works", params);
  const works = result?.results || [];

  if (works.length === 0) {
    console.log(`${colors.yellow}No academic papers matching the query were found.${colors.reset}`);
    return;
  }

  const ceramicsOnly = getOpt(parsed, "ceramics");
  const targetTitle = ceramicsOnly 
    ? "LITERATURE SEARCH (Core Ceramic Journals)" 
    : "LITERATURE SEARCH (Global Catalog)";
  const totalCount = result?.meta?.count ?? works.length;
  printTitle(`${targetTitle} - Page ${page} / Total ~${totalCount.toLocaleString()}, Page items ${works.length}`);

  const headers = ["ID / DOI", "Title", "Year", "Journal", "Cites", "Type", "OA"];
  const rows = works.map((w: any) => {
    const doiClean = w.doi ? cleanDOI(w.doi) : "";
    const idDisplay = doiClean 
      ? colors.yellow + doiClean + colors.reset 
      : colors.yellow + w.id.replace("https://openalex.org/", "") + colors.reset;

    const title = colors.bold + (w.title?.length > 50 ? w.title.substring(0, 47) + "..." : (w.title || "Untitled")) + colors.reset;
    const year = String(w.publication_year || "N/A");
    
    const sourceName = w.primary_location?.source?.display_name || "N/A";
    const jName = sourceName.length > 22 ? sourceName.substring(0, 19) + "..." : sourceName;
    
    const cites = String(w.cited_by_count ?? 0);
    const workType = (w.type || "N/A").toLowerCase();
    const oa = w.is_oa ? `${colors.green}OA${colors.reset}` : `${colors.gray}No${colors.reset}`;

    return [idDisplay, title, year, jName, cites, workType, oa];
  });

  printTable(headers, rows);

  if (totalCount > page * limit) {
    console.log(`${colors.gray}提示: 使用 -p ${page + 1} 查看下一页${colors.reset}\n`);
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
    console.error(`${colors.red}Error: Please specify query (-q) or at least one filter for aggregation analysis.${colors.reset}`);
    console.log(`Example: bun paper.ts group -q "sintering alumina" --by publication_year`);
    console.log(`Example: bun paper.ts group -q "zirconia" --by country`);
    return;
  }

  const params: Record<string, string> = {
    group_by: groupByField
  };

  if (query) params.search = String(query);
  if (filters.length > 0) params.filter = filters.join(",");

  console.log(`${colors.gray}Computing OpenAlex aggregated statistics for group_by=${groupByField}...${colors.reset}`);
  
  const result = await fetchOpenAlex("/works", params);
  const groups: Array<{ key: string; key_display_name?: string; count: number }> = result?.group_by || [];

  if (groups.length === 0) {
    console.log(`${colors.yellow}No statistical records found for group_by=${groupByField}.${colors.reset}`);
    return;
  }

  const totalCount = groups.reduce((acc, g) => acc + g.count, 0);

  printTitle(`GROUP-BY AGGREGATION ANALYSIS: ${groupByField} (Total indexed: ${totalCount.toLocaleString()})`);

  const maxCount = Math.max(...groups.map(g => g.count));
  const headers = ["Category / Key", "Count", "Share", "Distribution Visual"];

  const displayGroups = groups.slice(0, 20);

  const rows = displayGroups.map(g => {
    let keyName = g.key_display_name || g.key || "Unknown";
    keyName = keyName.replace(/^https:\/\/openalex\.org\/(countries|topics)\//, "");
    if (keyName.length > 35) keyName = keyName.substring(0, 32) + "...";
    
    const countStr = g.count.toLocaleString();
    const percent = totalCount > 0 ? (g.count / totalCount) * 100 : 0;
    const shareStr = `${percent.toFixed(1)}%`;
    
    const barRatio = maxCount > 0 ? g.count / maxCount : 0;
    const barWidth = Math.round(barRatio * 25);
    const visualBar = colors.cyan + "█".repeat(barWidth) + colors.reset;

    return [keyName, countStr, shareStr, visualBar];
  });

  printTable(headers, rows);

  if (groups.length > 20) {
    console.log(`${colors.gray}Showing top 20 of ${groups.length} groups.${colors.reset}\n`);
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
    console.error(`${colors.red}Error: Missing topic search keyword.${colors.reset}`);
    console.log(`Example: bun paper.ts topics "sintering"`);
    return;
  }

  console.log(`${colors.gray}Searching OpenAlex topic system for: "${query}"...${colors.reset}`);

  const params: Record<string, string> = {
    search: String(query),
    per_page: String(limit)
  };

  const result = await fetchOpenAlex("/topics", params);
  const topics = result?.results || [];

  if (topics.length === 0) {
    console.log(`${colors.yellow}No topics matching "${query}" were found.${colors.reset}`);
    return;
  }

  printTitle(`OPENALEX TOPIC CLASSIFICATION SYSTEM (Found ${result?.meta?.count || topics.length} topics)`);

  const headers = ["Topic ID", "Topic Name", "Subfield", "Field", "Works Count"];
  const rows = topics.map((t: any) => {
    const idShort = colors.yellow + (t.id ? t.id.replace("https://openalex.org/", "") : "N/A") + colors.reset;
    const name = colors.bold + (t.display_name?.length > 40 ? t.display_name.substring(0, 37) + "..." : (t.display_name || "N/A")) + colors.reset;
    const subfield = t.subfield?.display_name || "N/A";
    const field = t.field?.display_name || "N/A";
    const count = (t.works_count ?? 0).toLocaleString();

    return [idShort, name, subfield, field, count];
  });

  printTable(headers, rows);
  console.log(`${colors.gray}提示: 使用 bun paper.ts search --topic <TopicID> 进行该主题精准文献检索${colors.reset}\n`);
}

// -------------------------------------------------------------
// 4. Command handler: inst (active institution search)
// -------------------------------------------------------------
async function handleInst(parsed: any) {
  const query = getOpt(parsed, "query", "q") || parsed.positional[0];
  const limitRaw = parseInt(String(getOpt(parsed, "limit", "l") || "10"));
  const limit = Math.min(isNaN(limitRaw) ? 10 : limitRaw, 50);

  if (!query) {
    console.error(`${colors.red}Error: Missing institution search keyword.${colors.reset}`);
    console.log(`Example: bun paper.ts inst "Jingdezhen"`);
    return;
  }

  console.log(`${colors.gray}Searching OpenAlex institution database for: "${query}"...${colors.reset}`);

  const params: Record<string, string> = {
    search: String(query),
    per_page: String(limit)
  };

  const result = await fetchOpenAlex("/institutions", params);
  const insts = result?.results || [];

  if (insts.length === 0) {
    console.log(`${colors.yellow}No institutions matching "${query}" were found.${colors.reset}`);
    return;
  }

  printTitle(`OPENALEX INSTITUTION SEARCH (Found ${result?.meta?.count || insts.length} institutions)`);

  const headers = ["Inst ID", "Institution Name", "Country", "Type", "Works Count"];
  const rows = insts.map((i: any) => {
    const idShort = colors.yellow + (i.id ? i.id.replace("https://openalex.org/", "") : "N/A") + colors.reset;
    const name = colors.bold + (i.display_name?.length > 45 ? i.display_name.substring(0, 42) + "..." : (i.display_name || "N/A")) + colors.reset;
    const country = i.country_code || "N/A";
    const type = i.type || "N/A";
    const count = (i.works_count ?? 0).toLocaleString();

    return [idShort, name, country, type, count];
  });

  printTable(headers, rows);
  console.log(`${colors.gray}提示: 使用 bun paper.ts search --inst <InstID> 或 --country <CountryCode> 进行机构产出检索${colors.reset}\n`);
}

// -------------------------------------------------------------
// 5. Command handler: info (single or batch paper card)
// -------------------------------------------------------------
async function handleInfo(parsed: any) {
  const rawTargets = parsed.positional.flatMap(arg => arg.split(/[|,]/)).map(s => s.trim()).filter(Boolean);

  if (rawTargets.length === 0) {
    console.error(`${colors.red}Error: Missing DOI or OpenAlex ID argument.${colors.reset}`);
    console.log(`Example: bun paper.ts info 10.1111/jace.19034`);
    console.log(`Example: bun paper.ts info 10.1111/jace.19034 10.1016/j.jeurceramsoc.2021.01.001 --save report.md`);
    return;
  }

  if (rawTargets.length === 1) {
    const targetId = rawTargets[0];
    console.log(`${colors.gray}Retrieving paper details for: ${targetId}...${colors.reset}`);

    const work = await fetchSingleWork(targetId);

    if (!work) {
      console.error(`${colors.red}Error: Paper with ID/DOI "${targetId}" not found in database.${colors.reset}`);
      return;
    }

    printSingleWorkCard(work);
    saveReportIfRequested(parsed, [work]);
    return;
  }

  // Batch lookup for multiple DOIs / OpenAlex IDs
  console.log(`${colors.gray}Retrieving batch paper details for ${rawTargets.length} items...${colors.reset}`);

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
    console.error(`${colors.red}Error: None of the requested papers were found in database.${colors.reset}`);
    return;
  }

  printTitle(`BATCH ACADEMIC LITERATURE CARDS (Found ${works.length} of ${rawTargets.length} requested)`);
  
  const headers = ["ID / DOI", "Title", "Year", "Journal", "Cites", "OA"];
  const rows = works.map((w: any) => {
    const doiClean = w.doi ? cleanDOI(w.doi) : "";
    const idDisplay = doiClean ? colors.yellow + doiClean + colors.reset : colors.yellow + w.id.replace("https://openalex.org/", "") + colors.reset;
    const title = colors.bold + (w.title?.length > 45 ? w.title.substring(0, 42) + "..." : (w.title || "Untitled")) + colors.reset;
    const year = String(w.publication_year || "N/A");
    const jName = w.primary_location?.source?.display_name || "N/A";
    const jShort = jName.length > 20 ? jName.substring(0, 17) + "..." : jName;
    const cites = String(w.cited_by_count ?? 0);
    const oa = w.is_oa ? `${colors.green}OA${colors.reset}` : `${colors.gray}No${colors.reset}`;
    return [idDisplay, title, year, jShort, cites, oa];
  });

  printTable(headers, rows);

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
    return `${name} [${field} › ${domain}]`;
  });

  const allLocations: any[] = work.locations || [];
  const pdfUrl = work.primary_location?.pdf_url
    || allLocations.find((l: any) => l.pdf_url)?.pdf_url
    || null;

  console.log(`\n${colors.bold}${colors.cyan}================================================================================`);
  console.log(`                        ACADEMIC LITERATURE CARD`);
  console.log(`================================================================================${colors.reset}`);
  console.log(`  Title           : ${colors.bold}${work.title}${colors.reset}`);
  console.log(`  Type            : ${work.type || "N/A"}`);
  console.log(`  Authors         : ${authors || "N/A"}`);
  console.log(`  Source Journal  : ${work.primary_location?.source?.display_name || "N/A"}`);
  if (work.primary_location?.source?.issn) {
    console.log(`  ISSN            : ${work.primary_location.source.issn.join(", ")}`);
  }
  console.log(`  Pub Date        : ${work.publication_date || "N/A"} (Year: ${work.publication_year || "N/A"})`);
  console.log(`  Citations       : ${colors.bold}${work.cited_by_count ?? 0} citations${colors.reset}`);
  console.log(`  Open Access     : ${work.is_oa ? colors.green + "Yes (Free full text available)" + colors.reset : colors.gray + "No (Paywalled)" + colors.reset}`);
  console.log(`  Landing Page    : ${work.primary_location?.landing_page_url || work.doi || "N/A"}`);
  if (pdfUrl) {
    console.log(`  Direct PDF Link : ${colors.underline}${colors.green}${pdfUrl}${colors.reset}`);
  }
  if (topics.length > 0) {
    console.log(`\n${colors.bold}${colors.blue}------------------------------------ TOPICS ------------------------------------${colors.reset}`);
    topics.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
  }

  console.log(`\n${colors.bold}${colors.magenta}----------------------------------- ABSTRACT -----------------------------------${colors.reset}`);
  console.log(wordWrap(abstractText, 80));
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);
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
    console.log(`${colors.green}${colors.bold}[Success] Literature report saved successfully to: ${filename}${colors.reset}\n`);
  } catch (e: any) {
    console.error(`${colors.red}Failed to save report file: ${e.message}${colors.reset}`);
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
// 6. Command handler: download
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

  const allLocs: any[] = work.locations || [];
  const pdfUrl: string | null = work.primary_location?.pdf_url
    || allLocs.find((l: any) => l.pdf_url)?.pdf_url
    || null;
  
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

  let outputFilename = getOpt(parsed, "output", "o");
  if (!outputFilename || typeof outputFilename !== "string") {
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
        "User-Agent": "Mozilla/5.0 (compatible; paper-ts/1.0)"
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
